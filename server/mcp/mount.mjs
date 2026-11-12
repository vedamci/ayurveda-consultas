import path from 'node:path';
import { loadConfig } from './config.mjs';
import { createPolicyLoader } from './policy.mjs';
import { createClinicalAdapter } from './adapter.mjs';
import { createMcpRouter } from './router.mjs';

export function createMcpComponents({ usersFile, userDataDir, env = process.env }) {
  const config = loadConfig(env);
  // Status-only startup never reads Notion credentials, database ID or patient paths.
  // A clinical adapter can exist only after a second explicit deployment opt-in.
  const adapter = config.clinicalEnabled ? createClinicalAdapter({
    notionApiKey: env.MCP_NOTION_API_KEY,
    databaseId: env.NOTION_DATABASE_ID,
    localDataDir: path.join(userDataDir, 'local-data')
  }) : undefined;
  return { config, adapter, loadPrincipal: createPolicyLoader(config, usersFile) };
}

export function mountMcp(app, options) {
  app.use(createMcpRouter(createMcpComponents(options)));
}
