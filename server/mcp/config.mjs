import { z } from 'zod';
import path from 'node:path';

export const SCOPES = ['consultas:status', 'consultas:patients:search', 'consultas:patients:read', 'consultas:clinical:read'];
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('MCP requires a fixed HTTPS URL.');
  return url;
}
export function loadConfig(env = process.env) {
  const resource = httpsUrl(env.MCP_RESOURCE_URL);
  if (resource.pathname !== '/mcp') throw new Error('MCP_RESOURCE_URL must end in /mcp.');
  const issuer = httpsUrl(env.MCP_OAUTH_ISSUER);
  const jwks = httpsUrl(env.MCP_OAUTH_JWKS_URL);
  if (jwks.origin !== issuer.origin) throw new Error('JWKS must share the configured issuer origin.');
  const policyPath = env.MCP_POLICY_FILE;
  if (!policyPath || !path.isAbsolute(policyPath)) throw new Error('MCP_POLICY_FILE must be an absolute private file path.');
  const clients = String(env.MCP_OAUTH_CLIENT_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!clients.length || clients.some(x => x.length > 2048)) throw new Error('Explicit OAuth client IDs are required.');
  return Object.freeze({ resource: resource.href, origin: resource.origin, host: resource.host,
    issuer: issuer.href, jwks: jwks.href, policyPath, clients, scopes: SCOPES });
}
