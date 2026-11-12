// Independent status-only entrypoint. Does not import the web app or load .env.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { createMcpComponents } from './mount.mjs';
import { createMcpRouter } from './router.mjs';
import { readJsonFile } from './policy.mjs';

const KEYS = ['MCP_ENABLED', 'MCP_CLINICAL_ENABLED', 'MCP_RESOURCE_URL',
  'MCP_OAUTH_ISSUER', 'MCP_OAUTH_JWKS_URL', 'MCP_OAUTH_CLIENT_IDS',
  'MCP_POLICY_FILE', 'MCP_USERS_FILE'];

export function standaloneConfig(env = process.env) {
  let values;
  if (env.MCP_CONFIG_FILE) {
    if (!path.isAbsolute(env.MCP_CONFIG_FILE)) throw new Error('Private config path must be absolute.');
    const stat = fs.lstatSync(env.MCP_CONFIG_FILE);
    if (!stat.isFile() || (stat.mode & 0o077)) throw new Error('Private config must be a restricted regular file.');
    values = readJsonFile(env.MCP_CONFIG_FILE, 32768);
    if (!values || Array.isArray(values) || typeof values !== 'object') throw new Error('Invalid private config.');
    if (Object.entries(values).some(([key, value]) => !KEYS.includes(key) || typeof value !== 'string')) throw new Error('Unsupported private config field.');
    // No merge with inherited web environment: a dedicated file is authoritative.
  } else {
    values = Object.fromEntries(KEYS.map(key => [key, env[key]]).filter(([, value]) => value !== undefined));
  }
  if (values.MCP_ENABLED !== 'true') throw new Error('Standalone MCP is disabled.');
  if (values.MCP_CLINICAL_ENABLED !== undefined && values.MCP_CLINICAL_ENABLED !== 'false') throw new Error('Standalone MCP permits status only.');
  if (!values.MCP_USERS_FILE || !path.isAbsolute(values.MCP_USERS_FILE)) throw new Error('Explicit absolute users path required.');
  return Object.freeze({ ...values, MCP_CLINICAL_ENABLED: 'false' });
}

export function createStandaloneServer({ env = process.env, audit } = {}) {
  const values = standaloneConfig(env);
  const components = createMcpComponents({ usersFile: values.MCP_USERS_FILE, userDataDir: undefined, env: values });
  const app = express(); app.disable('x-powered-by');
  app.use(createMcpRouter({ ...components, ...(audit ? { audit } : {}) }));
  app.use((_req, res) => res.status(404).set('Cache-Control', 'no-store').json({ error: 'not_found' }));
  const server = http.createServer(app);
  server.maxHeadersCount = 64;
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  return { server, config: components.config };
}

export async function startStandalone({ env = process.env } = {}) {
  const { server } = createStandaloneServer({ env });
  const rawPort = env.PORT || '3000';
  if (!/^\d{1,5}$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('Invalid listener port.');
  // Passenger reverse-binds this single listener to its own Unix socket.
  // Direct Node invocation always stays on loopback, never all interfaces.
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(rawPort), '127.0.0.1', resolve);
  });
  const address = server.address();
  console.info(JSON.stringify({ component: 'mcp-status', event: 'listening', mode: 'status_only',
    localPort: typeof address === 'object' && address ? address.port : null }));
  const stop = () => {
    server.close(() => { process.exitCode = 0; });
    server.closeIdleConnections();
    const timer = setTimeout(() => server.closeAllConnections(), 2000); timer.unref();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startStandalone().catch(() => {
    console.error(JSON.stringify({ component: 'mcp-status', event: 'startup_failed' }));
    process.exitCode = 1;
  });
}
