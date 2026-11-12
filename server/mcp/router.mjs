import express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTokenVerifier } from './auth.mjs';
import { requireScope, AccessDenied, InsufficientScope } from './policy.mjs';
import { createMcpServer } from './tools.mjs';

export function createLimiter(max, maxKeys = 1000) {
  const buckets = new Map();
  return key => {
    const now = Date.now();
    for (const [id, value] of buckets) if (value.until <= now) buckets.delete(id);
    if (!buckets.has(key)) {
      if (buckets.size >= maxKeys) return false;
      buckets.set(key, { until: now + 60000, count: 0 });
    }
    return ++buckets.get(key).count <= max;
  };
}
export function createMcpRouter({ config, loadPrincipal, adapter,
  verifyToken = createTokenVerifier(config), audit = event => console.info(JSON.stringify({ component: 'mcp', ...event })) }) {
  if (Boolean(adapter) !== config.clinicalEnabled) throw new Error('MCP clinical configuration mismatch.');
  const router = express.Router({ strict: true });
  const ipLimit = createLimiter(120); const userLimit = createLimiter(30);
  let inFlight = 0;
  const metadataPath = '/.well-known/oauth-protected-resource/mcp';
  const challenge = `Bearer resource_metadata="${config.origin}${metadataPath}"`;
  router.use((req, res, next) => {
    const relevant = req.path === '/mcp' || req.path === '/mcp/' || req.path === metadataPath || req.path === '/.well-known/oauth-protected-resource';
    if (!relevant) return next('router');
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    // Never trust forwarded Host/Origin supplied by the caller. Proxy must preserve Host.
    if (req.get('host') !== config.host || (req.get('origin') && req.get('origin') !== config.origin)) return res.status(403).json({ error: 'request_denied' });
    if (!ipLimit(req.socket.remoteAddress || 'unknown')) return res.status(429).set('Retry-After', '60').json({ error: 'rate_limited' });
    next();
  });
  const metadata = (_req, res) => res.json({ resource: config.resource,
    authorization_servers: [config.issuer], scopes_supported: config.scopes, bearer_methods_supported: ['header'], resource_name: config.clinicalEnabled ? 'VEDAMCI Consultas (solo lectura)' : 'VEDAMCI Consultas (solo estado)' });
  router.get(metadataPath, metadata);
  router.get('/.well-known/oauth-protected-resource', metadata);
  router.all(['/mcp', '/mcp/'], async (req, res, next) => {
    req.mcpRequestId = randomUUID();
    if (req.method === 'OPTIONS') return res.status(405).set('Allow', 'POST, GET, DELETE').end();
    if (Object.keys(req.query).length || req.get('mcp-session-id')) return res.status(400).json({ error: 'invalid_request' });
    const header = req.get('authorization') || '';
    if (header.length > 8192 || !/^Bearer [A-Za-z0-9_.-]+$/.test(header)) return res.status(401).set('WWW-Authenticate', challenge).json({ error: 'authentication_required' });
    let payload;
    try { payload = await verifyToken(header.slice(7)); }
    catch {
      audit({ requestId: req.mcpRequestId, outcome: 'invalid_token' });
      return res.status(401).set('WWW-Authenticate', challenge + ', error="invalid_token"').json({ error: 'invalid_token' });
    }
    req.resolveMcpPrincipal = () => {
      if (payload.exp <= Math.floor(Date.now() / 1000)) throw new AccessDenied();
      const principal = loadPrincipal(payload); requireScope(principal, 'consultas:status'); return principal;
    };
    try {
      const principal = req.resolveMcpPrincipal();
      if (!userLimit(principal.profileId)) return res.status(429).set('Retry-After', '60').json({ error: 'rate_limited' });
    } catch (error) {
      audit({ requestId: req.mcpRequestId, outcome: error instanceof AccessDenied ? 'denied' : 'policy_unavailable' });
      if (error instanceof InsufficientScope) res.set('WWW-Authenticate', challenge + ', error="insufficient_scope", scope="consultas:status"');
      return res.status(error instanceof AccessDenied ? 403 : 503).json({ error: 'access_unavailable' });
    }
    if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').end();
    next();
  });
  router.post(['/mcp', '/mcp/'], express.json({ limit: '16kb', strict: true }), async (req, res) => {
    if (inFlight >= 8) return res.status(429).set('Retry-After', '5').json({ error: 'busy' });
    if (!req.is('application/json') || Array.isArray(req.body)) return res.status(400).json({ error: 'invalid_request' });
    inFlight++;
    let server;
    try {
      server = createMcpServer({ resolvePrincipal: req.resolveMcpPrincipal, adapter, audit, requestId: req.mcpRequestId, resourceMetadataUrl: config.origin + metadataPath });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      audit({ requestId: req.mcpRequestId, outcome: 'transport_error' });
      if (!res.headersSent) res.status(500).json({ error: 'request_failed' });
    } finally { inFlight--; await server?.close().catch(() => {}); }
  });
  router.use((error, _req, res, _next) => {
    res.status(error?.status === 413 ? 413 : 400).json({ error: 'invalid_request' });
  });
  return router;
}
