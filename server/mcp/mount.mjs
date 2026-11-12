import path from 'node:path';
import { loadConfig } from './config.mjs';
import { createPolicyLoader } from './policy.mjs';
import { createClinicalAdapter } from './adapter.mjs';
import { createMcpRouter } from './router.mjs';

export function mountMcp(app, { usersFile, userDataDir, env = process.env }) {
  const config = loadConfig(env);
  const adapter = createClinicalAdapter({ notionApiKey: env.MCP_NOTION_API_KEY,
    databaseId: env.NOTION_DATABASE_ID, localDataDir: path.join(userDataDir, 'local-data') });
  app.use(createMcpRouter({ config, adapter, loadPrincipal: createPolicyLoader(config, usersFile) }));
}
