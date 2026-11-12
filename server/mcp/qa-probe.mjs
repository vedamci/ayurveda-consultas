// Synthetic private loopback probe only. Never loads the web app or any .env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import express from 'express';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpComponents } from './mount.mjs';
import { createMcpRouter } from './router.mjs';
import { createTokenVerifier } from './auth.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'consultas-mcp-synthetic-'));
fs.chmodSync(root, 0o700);
const usersFile = path.join(root, 'synthetic-users.json');
const policyFile = path.join(root, 'synthetic-policy.json');
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const profileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const issuer = 'https://synthetic-issuer.invalid/';
fs.writeFileSync(usersFile, JSON.stringify([{ id: userId }]), { mode: 0o600 });
fs.writeFileSync(policyFile, JSON.stringify({ version: 1, issuer, grants: [{
  subject: 'synthetic-loopback-user', userId, profileId, enabled: true,
  scopes: ['consultas:status'], patientIds: [], revokedBefore: 0, revokedTokenIds: []
}] }), { mode: 0o600 });
const app = express(); app.disable('x-powered-by');
const listener = http.createServer(app);
let client;
try {
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  const host = `127.0.0.1:${port}`;
  const env = new Proxy({
    MCP_RESOURCE_URL: `https://${host}/mcp`, MCP_CLINICAL_ENABLED: 'false',
    MCP_OAUTH_ISSUER: issuer, MCP_OAUTH_JWKS_URL: issuer + 'jwks',
    MCP_POLICY_FILE: policyFile, MCP_OAUTH_CLIENT_IDS: 'synthetic-loopback-client'
  }, { get(target, key) {
    if (['MCP_NOTION_API_KEY', 'NOTION_DATABASE_ID', 'DATA_DIR'].includes(key)) throw new Error('Clinical environment access denied');
    return target[key];
  } });
  const components = createMcpComponents({ usersFile, userDataDir: undefined, env });
  assert.equal(components.adapter, undefined);
  // Ephemeral test-only signing material; never printed or written to disk.
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey); jwk.kid = 'synthetic-loopback';
  const verifyToken = createTokenVerifier(components.config, createLocalJWKSet({ keys: [jwk] }));
  app.use(createMcpRouter({ ...components, verifyToken, audit: () => {} }));
  app.use((_req, res) => res.status(404).end());
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ iss: issuer, aud: components.config.resource,
    sub: 'synthetic-loopback-user', client_id: 'synthetic-loopback-client',
    iat: now, exp: now + 60, jti: 'synthetic-loopback-token', scope: 'consultas:status'
  }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).sign(privateKey);
  const url = `http://${host}/mcp`;
  const metadata = await (await fetch(`http://${host}/.well-known/oauth-protected-resource/mcp`, { signal: AbortSignal.timeout(5000) })).json();
  assert.deepEqual(metadata.scopes_supported, ['consultas:status']);
  const missing = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 401); await missing.body?.cancel();
  client = new Client({ name: 'synthetic-private-qa', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const names = (await client.listTools()).tools.map(tool => tool.name).sort();
  assert.deepEqual(names, ['connection_status', 'get_profile']);
  const status = await client.callTool({ name: 'connection_status', arguments: {} });
  assert.deepEqual(status.structuredContent, { status: 'ok', mode: 'status_only', clinicalBackendChecked: false });
  const profile = await client.callTool({ name: 'get_profile', arguments: {} });
  assert.equal(profile.structuredContent.id, profileId);
  const clinical = await client.callTool({ name: 'read_patient_notes', arguments: { patientId: userId } });
  assert.equal(clinical.isError, true);
  fs.writeFileSync(usersFile, '[]', { mode: 0o600 });
  const denied = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) });
  assert.equal(denied.status, 403); await denied.body?.cancel();
  console.info(JSON.stringify({ result: 'passed', node: process.versions.node,
    boundAddress: '127.0.0.1', isolatedPort: port, tools: names,
    mode: 'status_only', clinicalBackendChecked: false, profileVerified: true,
    clinicalToolRejected: true, revocationVerified: true, oauthFlowVerified: false }));
} catch {
  console.error(JSON.stringify({ result: 'failed', phase: 'synthetic_loopback_probe' }));
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
  listener.closeAllConnections();
  await new Promise(resolve => listener.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
}
