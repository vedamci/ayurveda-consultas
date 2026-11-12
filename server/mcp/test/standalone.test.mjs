import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { standaloneConfig, createStandaloneServer } from '../standalone.mjs';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-standalone-test-'));
  fs.chmodSync(root, 0o700);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = { MCP_ENABLED: 'true', MCP_RESOURCE_URL: 'https://qa.example.invalid/mcp',
    MCP_OAUTH_ISSUER: 'https://issuer.example.invalid/', MCP_OAUTH_JWKS_URL: 'https://issuer.example.invalid/jwks',
    MCP_OAUTH_CLIENT_IDS: 'synthetic-client', MCP_POLICY_FILE: path.join(root, 'absent-policy.json'),
    MCP_USERS_FILE: path.join(root, 'absent-users.json') };
  const file = path.join(root, 'standalone.json');
  fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  return { root, config, file };
}
function request(port, method, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method,
      headers: { Host: 'qa.example.invalid', 'Content-Type': 'application/json', Connection: 'close' } }, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }); req.once('error', reject); req.end(method === 'POST' ? '{}' : undefined);
  });
}

test('standalone is explicitly enabled, status-only and requires absolute account configuration', t => {
  const f = setup(t);
  assert.throws(() => standaloneConfig({ ...f.config, MCP_ENABLED: 'false' }));
  assert.throws(() => standaloneConfig({ ...f.config, MCP_CLINICAL_ENABLED: 'true' }));
  assert.throws(() => standaloneConfig({ ...f.config, MCP_USERS_FILE: './users.json' }));
  const env = new Proxy(f.config, { get(target, key) {
    if (['MCP_NOTION_API_KEY', 'NOTION_DATABASE_ID', 'DATA_DIR', 'JWT_SECRET'].includes(key)) throw new Error('must not read clinical/web secrets');
    return target[key];
  } });
  const values = standaloneConfig(env);
  assert.equal(values.MCP_CLINICAL_ENABLED, 'false');
  assert.equal(values.MCP_USERS_FILE, f.config.MCP_USERS_FILE);
});

test('dedicated config file never merges inherited web environment or accepts clinical fields', t => {
  const f = setup(t);
  const values = standaloneConfig({ MCP_CONFIG_FILE: f.file, MCP_CLINICAL_ENABLED: 'true', MCP_NOTION_API_KEY: 'SYNTHETIC_FORBIDDEN' });
  assert.equal(values.MCP_CLINICAL_ENABLED, 'false');
  assert.equal(Object.hasOwn(values, 'MCP_NOTION_API_KEY'), false);
  fs.writeFileSync(f.file, JSON.stringify({ ...f.config, MCP_NOTION_API_KEY: 'SYNTHETIC_FORBIDDEN' }));
  assert.throws(() => standaloneConfig({ MCP_CONFIG_FILE: f.file }));
});

test('private config refuses symlinks and group/world-readable files', t => {
  const f = setup(t); fs.chmodSync(f.file, 0o644);
  assert.throws(() => standaloneConfig({ MCP_CONFIG_FILE: f.file }));
  fs.chmodSync(f.file, 0o600); const link = path.join(f.root, 'link.json'); fs.symlinkSync(f.file, link);
  assert.throws(() => standaloneConfig({ MCP_CONFIG_FILE: link }));
  assert.throws(() => standaloneConfig({ MCP_CONFIG_FILE: './relative.json' }));
});

test('minimal standalone transport serves only MCP metadata/challenges without account or patient files', async t => {
  const f = setup(t); const { server, config } = createStandaloneServer({ env: { MCP_CONFIG_FILE: f.file }, audit: () => {} });
  assert.equal(config.clinicalEnabled, false); assert.deepEqual(config.scopes, ['consultas:status']);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const port = server.address().port;
  assert.equal(server.address().address, '127.0.0.1');
  assert.equal((await request(port, 'POST', '/mcp')).status, 401);
  const metadata = await request(port, 'GET', '/.well-known/oauth-protected-resource/mcp');
  assert.deepEqual(JSON.parse(metadata.body).scopes_supported, ['consultas:status']);
  assert.equal((await request(port, 'GET', '/api/health')).status, 404);
  assert.equal((await request(port, 'GET', '/login')).status, 404);
  assert.equal(fs.existsSync(f.config.MCP_USERS_FILE), false);
  assert.equal(fs.existsSync(f.config.MCP_POLICY_FILE), false);
});

test('CLI ignores .env and fails generically before binding when explicit config is absent', t => {
  const f = setup(t);
  fs.writeFileSync(path.join(f.root, '.env'), 'MCP_ENABLED=true\nJWT_SECRET=SYNTHETIC_MUST_NOT_LOAD\n');
  const entry = fileURLToPath(new URL('../status-app.js', import.meta.url));
  const run = spawnSync(process.execPath, [entry], { cwd: f.root, env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 1);
  assert.deepEqual(JSON.parse(run.stderr.trim()), { component: 'mcp-status', event: 'startup_failed' });
  assert.equal(run.stdout, ''); assert.ok(!run.stderr.includes(f.root)); assert.ok(!run.stderr.includes('SYNTHETIC_MUST_NOT_LOAD'));
});

test('CLI binds its own ephemeral loopback listener and exits cleanly on its own SIGTERM', async t => {
  const f = setup(t); const entry = fileURLToPath(new URL('../status-app.js', import.meta.url));
  const child = spawn(process.execPath, [entry], { cwd: f.root, env: { PATH: process.env.PATH, MCP_CONFIG_FILE: f.file, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); });
  const ready = await new Promise((resolve, reject) => {
    let text = ''; const timer = setTimeout(() => reject(new Error('synthetic CLI startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('synthetic CLI exited before readiness')); });
    child.stdout.on('data', chunk => { text += chunk; if (text.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(text.split('\n')[0])); } });
  });
  assert.equal(ready.mode, 'status_only'); assert.ok(ready.localPort > 0);
  assert.equal((await request(ready.localPort, 'POST', '/mcp')).status, 401);
  child.kill('SIGTERM'); const [code] = await exited; assert.equal(code, 0);
});
