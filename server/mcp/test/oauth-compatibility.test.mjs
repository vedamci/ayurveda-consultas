import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.mjs';

// Provider compatibility characterization, not an end-to-end OAuth test.
// No live identities, credentials, network identity provider or clinical records.
test('documented Auth0 default shape is incompatible: missing jti', async t => {
  const f = await fixture(t, { statusOnly: true });
  await assert.rejects(f.verifyToken(await f.mint({ jti: undefined, client_id: undefined, azp: f.config.clients[0] })));
});

test('documented Auth0 OIDC/RFC9068 audience array is currently rejected', async t => {
  const f = await fixture(t, { statusOnly: true });
  await assert.rejects(f.verifyToken(await f.mint({ aud: [f.config.resource, f.config.issuer + 'userinfo'] }, { typ: 'at+jwt' })));
});

test('single resource RFC9068 shaped access token with approved client is accepted', async t => {
  const f = await fixture(t, { statusOnly: true });
  const claims = await f.verifyToken(await f.mint({}, { typ: 'at+jwt' }));
  assert.equal(claims.aud, f.config.resource);
  assert.deepEqual(f.loadPrincipal(claims).patientIds, []);
  assert.deepEqual(f.loadPrincipal(claims).scopes, ['consultas:status']);
});

test('ID token directed at client and unapproved CIMD client are rejected', async t => {
  const f = await fixture(t, { statusOnly: true });
  await assert.rejects(f.verifyToken(await f.mint({ aud: f.config.clients[0] }, { typ: 'JWT' })));
  await assert.rejects(f.verifyToken(await f.mint({ client_id: 'https://chatgpt.com/oauth/client.json' })));
});

test('provider default long lifetime cannot silently bypass fifteen-minute contract', async t => {
  const f = await fixture(t, { statusOnly: true });
  const now = Math.floor(Date.now() / 1000);
  await assert.rejects(f.verifyToken(await f.mint({ iat: now, exp: now + 3600 })));
  assert.equal(f.calls.length, 0);
});
