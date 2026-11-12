import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { SCOPES, uuid } from './config.mjs';

export class AccessDenied extends Error {}
export class Unavailable extends Error {}
export class InsufficientScope extends AccessDenied {}
const grantSchema = z.object({
  subject: z.string().min(1).max(256), userId: uuid, profileId: uuid,
  enabled: z.boolean(), scopes: z.array(z.enum(SCOPES)).max(4),
  patientIds: z.array(uuid).max(20), revokedBefore: z.number().int().nonnegative(),
  revokedTokenIds: z.array(z.string().min(1).max(256)).max(100)
}).strict();
const policySchema = z.object({ version: z.literal(1), issuer: z.string(),
  grants: z.array(grantSchema).max(100) }).strict();

// No create/migrate/write fallback; malformed or unavailable policy fails closed.
export function readJsonFile(file, maxBytes = 1024 * 1024) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) throw new Unavailable();
    const buffer = Buffer.alloc(maxBytes + 1);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > maxBytes) throw new Unavailable();
    return JSON.parse(buffer.subarray(0, size).toString('utf8'));
  } catch { throw new Unavailable(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function createPolicyLoader(config, usersFile) {
  return payload => {
    let policy;
    try { policy = policySchema.parse(readJsonFile(config.policyPath, 262144)); }
    catch { throw new Unavailable(); }
    if (policy.issuer !== config.issuer) throw new AccessDenied();
    const subjects = policy.grants.map(g => g.subject);
    const profiles = policy.grants.map(g => g.profileId);
    if (new Set(subjects).size !== subjects.length || new Set(profiles).size !== profiles.length) throw new Unavailable();
    const grant = policy.grants.find(g => g.subject === payload.sub && g.enabled);
    if (!grant || payload.iat <= grant.revokedBefore || grant.revokedTokenIds.includes(payload.jti)) throw new AccessDenied();
    const users = readJsonFile(usersFile);
    if (!Array.isArray(users) || !users.some(u => u.id === grant.userId && u.disabled !== true)) throw new AccessDenied();
    // Web role, email, self-registration and token-supplied roles never grant access.
    const tokenScopes = new Set(String(payload.scope || '').split(' '));
    return Object.freeze({ profileId: grant.profileId, patientIds: Object.freeze([...new Set(grant.patientIds)]),
      scopes: Object.freeze(grant.scopes.filter(s => tokenScopes.has(s))) });
  };
}
export function requireScope(principal, scope) {
  if (!principal.scopes.includes(scope)) throw new InsufficientScope();
}
export function requirePatient(principal, id) {
  if (!principal.patientIds.includes(id)) throw new AccessDenied();
}
export function containedFile(root, relative) {
  try {
    const base = fs.realpathSync(root);
    const target = path.resolve(base, relative);
    const actual = fs.realpathSync(target);
    if (!actual.startsWith(base + path.sep) || actual !== target) throw new Unavailable();
    return actual;
  } catch { throw new Unavailable(); }
}
