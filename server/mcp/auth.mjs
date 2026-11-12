import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createTokenVerifier(config, keySet = createRemoteJWKSet(new URL(config.jwks), {
  timeoutDuration: 3000, cooldownDuration: 30000, cacheMaxAge: 300000
})) {
  return async token => {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: config.issuer, audience: config.resource, algorithms: ['RS256', 'ES256'],
      requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat', 'jti'],
      maxTokenAge: '15m', clockTolerance: 0
    });
    // Single resource audience excludes ID tokens and unrelated/multi-resource tokens.
    if (payload.aud !== config.resource || typeof payload.sub !== 'string' || !payload.sub ||
        typeof payload.jti !== 'string' || !payload.jti || payload.jti.length > 256 ||
        payload.exp <= payload.iat || payload.exp - payload.iat > 900 ||
        payload.iat > Math.floor(Date.now() / 1000) || typeof payload.scope !== 'string' ||
        !config.clients.includes(payload.client_id || payload.azp)) throw new Error('Invalid access token');
    return payload;
  };
}
