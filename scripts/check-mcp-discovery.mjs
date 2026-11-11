#!/usr/bin/env node
// Public discovery checks only. No login, tokens, tools/call, or clinical API requests.
// Requires Node 20+. Does not install or configure a ChatGPT connection.
const KNOWN_APP_ORIGIN = 'https://consultas.vedamci.com.mx';
const DOMAIN_CANDIDATES = [
  'consultas.vedamci.com.mx',
  'consultas.yurveda.com',
  'consultas.vedamsi.com',
];
const MAX_RESPONSE_BYTES = 65536;

export function validateEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || !/^\/mcp\/?$/.test(url.pathname)) {
    throw new Error('Use an HTTPS /mcp URL without credentials, query, or fragment.');
  }
  return url;
}

export function advertisedMetadata(header, endpoint) {
  const match = String(header || '').match(/\bresource_metadata\s*=\s*"([^"]+)"/i);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    if (url.protocol !== 'https:' || url.origin !== new URL(endpoint).origin ||
        url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith('/.well-known/')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function rpcMessage(body, contentType) {
  try {
    if (/^application\/json(?:;|$)/i.test(contentType)) return JSON.parse(body);
    if (/^text\/event-stream(?:;|$)/i.test(contentType)) {
      for (const event of body.replace(/\r\n/g, '\n').split('\n\n')) {
        const data = event.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const message = JSON.parse(data);
        if (message.id === 1) return message;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function classifyInitialize(response, endpoint) {
  if (response.status === 401) {
    const metadataUrl = advertisedMetadata(response.challenge, endpoint);
    return {
      state: metadataUrl ? 'authentication_required_metadata_advertised' : 'authentication_required_discovery_missing',
      metadataUrl,
    };
  }
  if (response.status >= 300 && response.status < 400) return { state: 'redirect_not_followed' };
  if (response.status !== 200) return { state: 'http_error', status: response.status };
  if (/text\/html/i.test(response.contentType)) return { state: 'html_instead_of_mcp' };
  const message = rpcMessage(response.body, response.contentType);
  if (!message || message.jsonrpc !== '2.0' || message.id !== 1) return { state: 'invalid_mcp_response' };
  if (message.error) return { state: 'mcp_initialization_error' };
  const result = message.result;
  if (!result || typeof result.protocolVersion !== 'string' ||
      !result.serverInfo || typeof result.serverInfo.name !== 'string' ||
      typeof result.serverInfo.version !== 'string' ||
      !result.capabilities || typeof result.capabilities !== 'object') {
    return { state: 'invalid_initialize_result' };
  }
  // Public initialization is not proof of authorization or clinical safety.
  return { state: 'transport_initialized_authorization_not_tested' };
}

export function classifyResourceMetadata(response) {
  if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.contentType)) {
    return { state: 'resource_metadata_unavailable' };
  }
  try {
    const doc = JSON.parse(response.body);
    const safeHttps = value => {
      if (typeof value !== 'string') return false;
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
    };
    if (!safeHttps(doc.resource) || !Array.isArray(doc.authorization_servers) ||
        doc.authorization_servers.length === 0 || !doc.authorization_servers.every(safeHttps)) {
      return { state: 'resource_metadata_invalid' };
    }
    return { state: 'resource_metadata_present_oauth_flow_not_tested' };
  } catch {
    return { state: 'resource_metadata_invalid' };
  }
}

async function publicRequest(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    let body = '';
    let byteCount = 0;
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) { body += decoder.decode(); break; }
          byteCount += chunk.value.byteLength;
          if (byteCount > MAX_RESPONSE_BYTES) throw new Error('response_limit');
          body += decoder.decode(chunk.value, { stream: true });
          if (/^text\/event-stream/i.test(contentType) &&
              rpcMessage(body, contentType)?.id === 1) break;
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
    }
    return {
      status: response.status,
      contentType,
      challenge: response.headers.get('www-authenticate') || '',
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function selfTest() {
  let count = 0;
  const check = (condition, label) => {
    if (!condition) throw new Error('Self-test failed: ' + label);
    count++;
  };
  const endpoint = KNOWN_APP_ORIGIN + '/mcp';
  check(validateEndpoint(endpoint).href === endpoint, 'canonical endpoint');
  for (const url of [
    'http://example.com/mcp', 'https://user:secret@example.com/mcp',
    'https://example.com/mcp?token=secret', 'https://example.com/api/patients',
    'https://example.com/mcp#secret',
  ]) {
    let rejected = false;
    try { validateEndpoint(url); } catch { rejected = true; }
    check(rejected, 'reject unsafe endpoint');
  }
  const metadataUrl = KNOWN_APP_ORIGIN + '/.well-known/oauth-protected-resource/mcp';
  const challenge = 'Bearer resource_metadata="' + metadataUrl + '"';
  check(advertisedMetadata(challenge, endpoint) === metadataUrl, 'same-origin metadata');
  check(advertisedMetadata('Bearer resource_metadata="https://other.example/.well-known/oauth-protected-resource"', endpoint) === null, 'no cross-origin discovery fetch');
  check(classifyInitialize({ status: 200, contentType: 'text/html', body: '<html>SPA</html>' }, endpoint).state === 'html_instead_of_mcp', 'SPA fallback');
  check(classifyInitialize({ status: 401, challenge }, endpoint).state === 'authentication_required_metadata_advertised', 'OAuth challenge');
  check(classifyInitialize({ status: 401 }, endpoint).state === 'authentication_required_discovery_missing', 'missing discovery');
  check(classifyInitialize({ status: 302 }, endpoint).state === 'redirect_not_followed', 'redirect');
  check(classifyInitialize({ status: 503 }, endpoint).state === 'http_error', 'HTTP error');
  const message = { jsonrpc: '2.0', id: 1, result: {
    protocolVersion: '2025-11-25', serverInfo: { name: 'synthetic', version: '1' }, capabilities: {},
  } };
  check(classifyInitialize({ status: 200, contentType: 'application/json', body: JSON.stringify(message) }, endpoint).state === 'transport_initialized_authorization_not_tested', 'JSON initialization');
  check(classifyInitialize({ status: 200, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify(message) + '\n\n' }, endpoint).state === 'transport_initialized_authorization_not_tested', 'SSE initialization');
  check(classifyInitialize({ status: 200, contentType: 'application/json', body: '{"jsonrpc":"2.0","id":99}' }, endpoint).state === 'invalid_mcp_response', 'response id');
  check(classifyInitialize({ status: 200, contentType: 'application/json', body: '{"jsonrpc":"2.0","id":1,"error":{"code":-32600}}' }, endpoint).state === 'mcp_initialization_error', 'RPC error');
  check(classifyResourceMetadata({ status: 200, contentType: 'application/json', body: JSON.stringify({
    resource: endpoint, authorization_servers: ['https://auth.example'],
  }) }).state === 'resource_metadata_present_oauth_flow_not_tested', 'metadata');
  check(classifyResourceMetadata({ status: 200, contentType: 'application/json', body: '{"resource":"https://example.com"}' }).state === 'resource_metadata_invalid', 'invalid metadata');
  check(classifyResourceMetadata({ status: 200, contentType: 'text/html', body: '<html>' }).state === 'resource_metadata_unavailable', 'metadata HTML');
  return { selfTestsPassed: count };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    console.log(JSON.stringify(selfTest(), null, 2));
    return;
  }
  if (args.length > 1 || (args[0] && args[0].startsWith('-'))) {
    throw new Error('Usage: node scripts/check-mcp-discovery.mjs [https://host/mcp | --self-test]');
  }
  const endpoint = validateEndpoint(args[0] || KNOWN_APP_ORIGIN + '/mcp');
  const { lookup } = await import('node:dns/promises');
  const report = { mode: 'public_metadata_only', domains: [], checks: {} };
  for (const hostname of DOMAIN_CANDIDATES) {
    try {
      const records = await lookup(hostname, { all: true });
      report.domains.push({ hostname, dns: 'resolved', addressCount: records.length });
    } catch {
      report.domains.push({ hostname, dns: 'unresolved_from_this_host' });
    }
  }
  // Never print response bodies, session identifiers, cookies, tokens, or raw errors.
  try {
    const login = await publicRequest(new URL('/login', endpoint), { method: 'HEAD' });
    report.checks.web = { https: 'responded', status: login.status };
  } catch {
    report.checks.web = { https: 'request_failed_from_this_host' };
  }
  try {
    const response = await publicRequest(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'consultas-discovery-check', version: '1.0.0' },
        },
      }),
    });
    const result = classifyInitialize(response, endpoint);
    report.checks.mcp = { state: result.state, status: response.status };
    if (result.metadataUrl) {
      try {
        const metadata = await publicRequest(result.metadataUrl, { headers: { Accept: 'application/json' } });
        report.checks.discovery = classifyResourceMetadata(metadata);
      } catch {
        report.checks.discovery = { state: 'metadata_request_failed_from_this_host' };
      }
    }
  } catch {
    report.checks.mcp = { state: 'request_failed_from_this_host' };
  }
  report.connectionInstalled = 'not_tested';
  report.clinicalAuthorization = 'not_tested';
  console.log(JSON.stringify(report, null, 2));
  // Reaching an MCP transport or an OAuth challenge is still not an end-to-end pass.
  process.exitCode = ['transport_initialized_authorization_not_tested',
    'authentication_required_metadata_advertised'].includes(report.checks.mcp.state) ? 0 : 1;
}

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { pathToFileURL } = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(() => {
      console.error('Discovery check failed. Check Node version, URL, and network locally; no secrets were printed.');
      process.exitCode = 1;
    });
  }
}
