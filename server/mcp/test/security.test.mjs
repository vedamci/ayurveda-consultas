import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig, SCOPES } from '../config.mjs';
import { AccessDenied, Unavailable } from '../policy.mjs';
import { createLimiter, createMcpRouter } from '../router.mjs';
import { createMcpComponents } from '../mount.mjs';
import { fixture, P1, P2, E1, U2 } from './fixtures.mjs';

const callData = result => result.body.result.structuredContent;
const denied = result => assert.equal(result.body.result.isError, true);

test('official SDK client initializes, lists seven tools and calls status/profile without clinical I/O', async t => {
  const f = await fixture(t);
  const client = new Client({ name: 'synthetic-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(f.url), { requestInit: { headers: { Authorization: `Bearer ${f.token}` } } });
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 7);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint && !tool.annotations.openWorldHint));
  assert.equal(tools.find(x => x.name === 'get_profile')._meta['openai/profile'], true);
  const status = await client.callTool({ name: 'connection_status', arguments: {} });
  assert.deepEqual(status.structuredContent, { status: 'ok', mode: 'read_only', clinicalBackendChecked: false });
  const profile = await client.callTool({ name: 'get_profile', arguments: {} });
  assert.equal(profile.structuredContent.id, f.grant.profileId);
  assert.equal(f.calls.length, 0);
  await client.close();
});

test('public resource discovery and unauthenticated challenge do not read any clinical data', async t => {
  const f = await fixture(t);
  const result = await f.rpc('initialize', {}, null);
  assert.equal(result.response.status, 401);
  assert.match(result.response.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/);
  const response = await fetch(f.url.replace('/mcp', '/.well-known/oauth-protected-resource/mcp'));
  const metadata = await response.json();
  assert.equal(metadata.resource, f.config.resource);
  assert.deepEqual(metadata.authorization_servers, [f.config.issuer]);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.length, 0);
});

test('cryptographic verifier rejects issuer, audience, client, expiry, future nbf, lifetime, absent claims and tampering', async t => {
  const f = await fixture(t); const now = Math.floor(Date.now() / 1000);
  for (const overrides of [{ iss: 'https://evil.invalid/' }, { aud: 'other-resource' },
    { aud: [f.config.resource, 'other'] }, { client_id: 'other-client' }, { exp: now - 1 },
    { nbf: now + 60 }, { iat: now + 20 }, { exp: now + 901 }, { jti: '' }, { sub: '' }, { scope: undefined }, { exp: undefined }]) {
    await assert.rejects(f.verifyToken(await f.mint(overrides)));
  }
  const parts = f.token.split('.'); parts[1] = Buffer.from(JSON.stringify({ sub: 'forged' })).toString('base64url');
  await assert.rejects(f.verifyToken(parts.join('.')));
  assert.equal((await f.rpc('tools/list', {}, parts.join('.'))).response.status, 401);
  assert.equal(f.calls.length, 0);
});

test('web session tokens, query tokens, foreign Origin/Host and session IDs are rejected', async t => {
  const f = await fixture(t);
  assert.equal((await f.rpc('tools/list', {}, 'webpayload.signature')).response.status, 401);
  assert.equal((await f.rpc('tools/list', {}, f.token, { Origin: 'https://evil.invalid' })).response.status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(f.url, { method: 'POST', headers: { Host: 'evil.invalid' } }, res => {
      res.resume(); resolve(res.statusCode);
    }); req.on('error', reject); req.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await f.rpc('tools/list', {}, f.token, { 'mcp-session-id': 'other-user-session' })).response.status, 400);
  assert.equal((await fetch(f.url + '?access_token=synthetic', { method: 'POST' })).status, 400);
  assert.equal(f.calls.length, 0);
});

test('registration, web admin role and token roles confer no MCP access', async t => {
  const f = await fixture(t);
  const token = await f.mint({ sub: 'unassigned', role: 'admin', userId: U2 });
  assert.equal((await f.rpc('tools/list', {}, token)).response.status, 403);
  f.grant.enabled = false; f.save();
  assert.equal((await f.tool('connection_status')).response.status, 403);
  assert.equal(f.calls.length, 0);
});

test('policy is live: grant removal, JTI revocation and account deletion take effect without restart', async t => {
  const f = await fixture(t);
  assert.equal((await f.tool('connection_status')).response.status, 200);
  f.grant.revokedTokenIds = ['synthetic-token']; f.save();
  assert.equal((await f.tool('connection_status')).response.status, 403);
  f.grant.revokedTokenIds = []; f.grant.revokedBefore = Math.floor(Date.now() / 1000); f.save();
  assert.equal((await f.tool('connection_status')).response.status, 403);
  f.grant.revokedBefore = 0; f.save(); fs.writeFileSync(f.usersFile, '[]');
  assert.equal((await f.tool('connection_status')).response.status, 403);
});

test('missing, malformed, duplicate or overbroad policy fails closed', async t => {
  const f = await fixture(t);
  for (const mutation of [() => fs.unlinkSync(f.policyPath), () => fs.writeFileSync(f.policyPath, '{'),
    () => { f.grant.patientIds = ['*']; f.save(); },
    () => { f.grant.patientIds = [P1]; f.policy.grants.push({ ...f.grant }); f.save(); }]) {
    mutation(); assert.equal((await f.tool('connection_status')).response.status, 503);
  }
  assert.equal(f.calls.length, 0);
});

test('effective scopes are intersection of provider and local grants', async t => {
  const f = await fixture(t);
  const limited = await f.mint({ scope: 'consultas:status' });
  assert.equal((await f.tool('connection_status', {}, limited)).body.result.isError, undefined);
  const missingScope = await f.tool('read_patient_notes', { patientId: P1 }, limited); denied(missingScope);
  assert.match(missingScope.body.result._meta['mcp/www_authenticate'][0], /insufficient_scope/);
  f.grant.scopes = ['consultas:status']; f.save();
  denied(await f.tool('search_patients', { query: 'Paciente' }));
  assert.equal(f.calls.length, 0);
});

test('guessed patient and cross-account entry IDs cause no unauthorized upstream or disk reads', async t => {
  const f = await fixture(t);
  denied(await f.tool('read_patient_summary', { patientId: P2 }));
  denied(await f.tool('list_patient_entries', { patientId: P2, kind: 'visits' }));
  denied(await f.tool('read_patient_entry', { patientId: P2, kind: 'visits', entryId: E1 }));
  assert.equal(f.calls.length, 0);
  const other = await f.mint({ sub: 'synthetic-other' });
  denied(await f.tool('read_patient_notes', { patientId: P1 }, other));
  assert.equal(f.calls.length, 0);
});

test('search is accent-insensitive, limited and confined to explicit page grants', async t => {
  const f = await fixture(t);
  const result = await f.tool('search_patients', { query: 'ficticio', limit: 1 });
  assert.deepEqual(callData(result).patients.map(p => p.patientId), [P1]);
  assert.equal(f.calls.length, 1); assert.ok(f.calls[0].url.endsWith(P1));
  assert.ok(!JSON.stringify(result.body).includes('CONTACTO_FICTICIO'));
  assert.ok(!JSON.stringify(result.body).includes('NOTA_FICTICIA'));
  denied(await f.tool('search_patients', { query: '  ' }));
  denied(await f.tool('search_patients', { query: 'Pa' }));
  denied(await f.tool('search_patients', { query: 'Paciente', limit: 100 }));
  assert.equal(f.calls.length, 1);
});

test('notes and selected local entries are projected without credentials, contact, attachments or extra fields', async t => {
  const f = await fixture(t);
  const notes = callData(await f.tool('read_patient_notes', { patientId: P1 }));
  assert.match(notes.notes, /NOTA_FICTICIA/);
  const entries = callData(await f.tool('list_patient_entries', { patientId: P1, kind: 'visits' }));
  assert.equal(entries.entries[0].entryId, E1); assert.equal(entries.nextOffset, null);
  const selected = await f.tool('read_patient_entry', { patientId: P1, kind: 'visits', entryId: E1 });
  assert.equal(callData(selected).entry.note, 'SOLO_NOTA_FICTICIA');
  const serialized = JSON.stringify(selected.body);
  for (const secret of ['NEVER_RETURN', 'pdfFile', 'SYNTHETIC_NOTION_KEY', 'SYNTHETIC_PASSWORD_HASH', 'CONTACTO_FICTICIO']) assert.ok(!serialized.includes(secret));
});

test('wrong database membership and archived pages fail closed', async t => {
  const f = await fixture(t);
  f.pages[P1].parent.database_id = P2;
  denied(await f.tool('read_patient_notes', { patientId: P1 }));
  f.pages[P1].parent.database_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'; f.pages[P1].archived = true;
  denied(await f.tool('read_patient_summary', { patientId: P1 }));
});

test('map traversal, external symlink and missing records are denied without migration or directory creation', async t => {
  const f = await fixture(t); const principal = f.loadPrincipal(await f.verifyToken(f.token));
  fs.writeFileSync(path.join(f.localDataDir, 'patient_folders.json'), JSON.stringify({ [P1]: '../outside' }));
  await assert.rejects(f.adapter.entries(principal, P1, 'visits', 0, 5), Unavailable);
  fs.writeFileSync(path.join(f.localDataDir, 'patient_folders.json'), JSON.stringify({ [P1]: 'Linked' }));
  fs.symlinkSync(f.dir, path.join(f.localDataDir, 'patients', 'Linked'));
  await assert.rejects(f.adapter.entries(principal, P1, 'visits', 0, 5), Unavailable);
  fs.writeFileSync(path.join(f.localDataDir, 'patient_folders.json'), JSON.stringify({ [P1]: 'Missing' }));
  await assert.rejects(f.adapter.entries(principal, P1, 'visits', 0, 5), Unavailable);
  assert.equal(fs.existsSync(path.join(f.localDataDir, 'patients', 'Missing')), false);
});

test('upstream failures, body limits and errors are generic; logs contain no token or clinical values', async t => {
  const f = await fixture(t, { upstream: () => { throw new Error('NOTA_FICTICIA SYNTHETIC_NOTION_KEY'); } });
  const result = await f.tool('read_patient_notes', { patientId: P1 }); denied(result);
  assert.ok(!JSON.stringify(result.body).includes('NOTA_FICTICIA'));
  const response = await fetch(f.url, { method: 'POST', headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ large: 'x'.repeat(17000) }) });
  assert.equal(response.status, 413);
  const logs = JSON.stringify(f.audit);
  for (const value of [f.token, 'NOTA_FICTICIA', 'SYNTHETIC_NOTION_KEY', P1, 'synthetic-durga']) assert.ok(!logs.includes(value));
});

test('policy revocation during a pending read prevents release of clinical results', async t => {
  let duringRead;
  const f = await fixture(t, { upstream: async (_url, _init, pages) => {
    duringRead(); return new Response(JSON.stringify(pages[P1]));
  } });
  duringRead = () => { f.grant.enabled = false; f.save(); };
  const result = await f.tool('read_patient_notes', { patientId: P1 }); denied(result);
  assert.ok(!JSON.stringify(result.body).includes('NOTA_FICTICIA'));
});

test('no arbitrary URLs, paths, write tools or unbounded enumeration parameters', async t => {
  const f = await fixture(t);
  for (const [name, args] of [['delete_patient', { patientId: P1 }], ['request', { url: 'https://evil.invalid' }],
    ['read_patient_notes', { patientId: '../users.json' }], ['read_patient_notes', { patientId: P1, path: '/etc/passwd' }],
    ['list_patient_entries', { patientId: P1, kind: 'contextDocuments' }]]) {
    const result = await f.tool(name, args);
    assert.ok(result.body.error || result.body.result?.isError);
  }
  assert.equal(f.calls.length, 0);
});

test('stateless HTTP rejects standalone SSE, DELETE and batches; no session bearer is minted', async t => {
  const f = await fixture(t);
  for (const method of ['GET', 'DELETE']) assert.equal((await fetch(f.url, { method, headers: { Authorization: `Bearer ${f.token}` } })).status, 405);
  const batch = await fetch(f.url, { method: 'POST', headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' }, body: '[]' });
  assert.equal(batch.status, 400);
  const initialized = await f.rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } });
  assert.equal(initialized.response.headers.get('mcp-session-id'), null);
});

test('rate limiter has bounded cardinality and cannot be bypassed by allocating more buckets', () => {
  const limit = createLimiter(2, 1);
  assert.equal(limit('one'), true); assert.equal(limit('one'), true); assert.equal(limit('one'), false); assert.equal(limit('two'), false);
});

test('configuration rejects HTTP, arbitrary paths, remote JWKS, empty clients and relative policy paths', () => {
  const env = { MCP_RESOURCE_URL: 'https://consultas.example.invalid/mcp', MCP_OAUTH_ISSUER: 'https://identity.example.invalid/',
    MCP_OAUTH_JWKS_URL: 'https://identity.example.invalid/jwks', MCP_POLICY_FILE: '/private/policy.json', MCP_OAUTH_CLIENT_IDS: 'synthetic-client' };
  assert.equal(loadConfig(env).resource, env.MCP_RESOURCE_URL);
  for (const change of [{ MCP_RESOURCE_URL: 'http://example.invalid/mcp' }, { MCP_RESOURCE_URL: 'https://example.invalid/other' },
    { MCP_OAUTH_JWKS_URL: 'https://evil.invalid/jwks' }, { MCP_OAUTH_CLIENT_IDS: '' }, { MCP_POLICY_FILE: './policy.json' }]) assert.throws(() => loadConfig({ ...env, ...change }));
});


test('symlinked patients root cannot escape the configured local-data directory', async t => {
  const f = await fixture(t); const principal = f.loadPrincipal(await f.verifyToken(f.token));
  fs.renameSync(path.join(f.localDataDir, 'patients'), path.join(f.dir, 'outside-patients'));
  fs.symlinkSync(path.join(f.dir, 'outside-patients'), path.join(f.localDataDir, 'patients'));
  await assert.rejects(f.adapter.entries(principal, P1, 'visits', 0, 5), Unavailable);
});

test('long clinical values are bounded and explicitly marked truncated', async t => {
  const f = await fixture(t);
  f.pages[P1].properties.Notas.rich_text = [{ plain_text: 'x'.repeat(9000) }];
  const notes = callData(await f.tool('read_patient_notes', { patientId: P1 }));
  assert.equal(notes.notes.length, 8000); assert.equal(notes.truncated, true);
  const file = path.join(f.localDataDir, 'patients', 'Ficticio', 'records.json');
  const data = JSON.parse(fs.readFileSync(file)); data.visits[0].note = 'x'.repeat(5000); fs.writeFileSync(file, JSON.stringify(data));
  const entry = callData(await f.tool('read_patient_entry', { patientId: P1, kind: 'visits', entryId: E1 }));
  assert.equal(entry.entry.note.length, 4000); assert.equal(entry.truncated, true);
});

test('malformed JSON returns a generic error; no fallback exposes the web app', async t => {
  const f = await fixture(t);
  const response = await fetch(f.url, { method: 'POST', headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' }, body: '{INVALID_SYNTHETIC_BODY' });
  assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: 'invalid_request' });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('Notion response size limits reject large payloads without returning partial notes', async t => {
  const f = await fixture(t, { upstream: () => new Response('x'.repeat(1048577)) });
  const result = await f.tool('read_patient_notes', { patientId: P1 }); denied(result);
  assert.ok(JSON.stringify(result.body).length < 1000);
});

test('policy pilot cap prevents a broad patient database grant', async t => {
  const f = await fixture(t);
  f.grant.patientIds = Array(21).fill(P1); f.save();
  assert.equal((await f.tool('connection_status')).response.status, 503);
  assert.equal(f.calls.length, 0);
});

test('main mounts MCP before web CORS/parser and never imports it when disabled', () => {
  const source = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8');
  const optIn = source.indexOf("if (process.env.MCP_ENABLED === 'true')");
  assert.ok(optIn > 0 && optIn < source.indexOf('app.use(cors())'));
  assert.ok(source.indexOf("await import('./mcp/mount.mjs')", optIn) < source.indexOf('app.use(express.json('));
  const example = JSON.parse(fs.readFileSync(new URL('../access-policy.example.json', import.meta.url)));
  assert.deepEqual(example.grants, []);
});


test('status-only components start without reading Notion credentials, database ID or patient paths', () => {
  const values = { MCP_RESOURCE_URL: 'https://consultas.example.invalid/mcp', MCP_OAUTH_ISSUER: 'https://identity.example.invalid/',
    MCP_OAUTH_JWKS_URL: 'https://identity.example.invalid/jwks', MCP_POLICY_FILE: '/synthetic/not-installed/policy.json', MCP_OAUTH_CLIENT_IDS: 'synthetic-client' };
  const env = new Proxy(values, { get(target, key) {
    if (['MCP_NOTION_API_KEY', 'NOTION_DATABASE_ID', 'DATA_DIR'].includes(key)) throw new Error('Clinical environment must not be accessed');
    return target[key];
  } });
  const components = createMcpComponents({ usersFile: '/synthetic/not-installed/users.json', userDataDir: undefined, env });
  assert.equal(components.config.clinicalEnabled, false);
  assert.deepEqual(components.config.scopes, ['consultas:status']);
  assert.equal(components.adapter, undefined);
  // Constructing router does not fetch JWKS or touch absent user/policy files.
  assert.ok(createMcpRouter(components));
});

test('status-only SDK connection offers exactly status/profile and no clinical scopes or tools', async t => {
  const f = await fixture(t, { statusOnly: true });
  // Make every patient path absent before any RPC. No clinical adapter is created.
  fs.rmSync(f.localDataDir, { recursive: true });
  assert.equal(f.adapter, undefined);
  const client = new Client({ name: 'synthetic-status-client', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(f.url), { requestInit: { headers: { Authorization: `Bearer ${f.token}` } } }));
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['connection_status', 'get_profile']);
  assert.ok(tools.every(tool => JSON.stringify(tool._meta.securitySchemes) === JSON.stringify([{ type: 'oauth2', scopes: ['consultas:status'] }])));
  const status = await client.callTool({ name: 'connection_status', arguments: {} });
  assert.deepEqual(status.structuredContent, { status: 'ok', mode: 'status_only', clinicalBackendChecked: false });
  const profile = await client.callTool({ name: 'get_profile', arguments: {} });
  assert.equal(profile.structuredContent.id, f.grant.profileId);
  const metadata = await (await fetch(f.url.replace('/mcp', '/.well-known/oauth-protected-resource/mcp'))).json();
  assert.deepEqual(metadata.scopes_supported, ['consultas:status']);
  assert.equal(f.calls.length, 0);
  await client.close();
});

test('status-only mode denies anonymous/unassigned requests and clinical calls despite broad token/grant', async t => {
  const f = await fixture(t, { statusOnly: true });
  const principal = f.loadPrincipal(await f.verifyToken(f.token));
  assert.deepEqual(principal.scopes, ['consultas:status']); assert.deepEqual(principal.patientIds, []);
  assert.equal((await f.rpc('tools/list', {}, null)).response.status, 401);
  assert.equal((await f.tool('connection_status', {}, await f.mint({ sub: 'unassigned' }))).response.status, 403);
  for (const name of ['search_patients', 'read_patient_summary', 'read_patient_notes', 'list_patient_entries', 'read_patient_entry']) {
    const result = await f.tool(name, { patientId: P1, query: 'Ficticio', kind: 'visits', entryId: E1 });
    assert.ok(result.body.error || result.body.result?.isError);
  }
  assert.equal(f.calls.length, 0);
});

test('clinical opt-in remains separate and fails closed when its required configuration is absent', () => {
  const env = { MCP_RESOURCE_URL: 'https://consultas.example.invalid/mcp', MCP_OAUTH_ISSUER: 'https://identity.example.invalid/',
    MCP_OAUTH_JWKS_URL: 'https://identity.example.invalid/jwks', MCP_POLICY_FILE: '/private/synthetic-policy.json', MCP_OAUTH_CLIENT_IDS: 'synthetic-client' };
  assert.equal(loadConfig(env).clinicalEnabled, false);
  assert.equal(loadConfig({ ...env, MCP_CLINICAL_ENABLED: 'true' }).clinicalEnabled, true);
  assert.throws(() => createMcpComponents({ usersFile: '/private/synthetic-users.json', userDataDir: '/synthetic-data', env: { ...env, MCP_CLINICAL_ENABLED: 'true' } }));
  assert.throws(() => loadConfig({ ...env, MCP_CLINICAL_ENABLED: 'TRUE' }));
  assert.throws(() => createMcpRouter({ config: loadConfig(env), adapter: {} }), /clinical configuration mismatch/);
});

test('status-only revocation still works and never releases a profile after account deletion', async t => {
  const f = await fixture(t, { statusOnly: true });
  assert.equal((await f.tool('get_profile')).body.result.structuredContent.id, f.grant.profileId);
  fs.writeFileSync(f.usersFile, '[]');
  const deniedProfile = await f.tool('get_profile');
  assert.equal(deniedProfile.response.status, 403);
  assert.ok(!JSON.stringify(deniedProfile.body).includes(f.grant.profileId));
  assert.equal(f.calls.length, 0);
});
