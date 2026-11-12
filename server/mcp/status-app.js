// Passenger/direct Node entrypoint for the independent status-only service.
// Start explicitly: Passenger may import the startup file through its own loader.
import { startStandalone } from './standalone.mjs';
try {
  await startStandalone();
} catch {
  console.error(JSON.stringify({ component: 'mcp-status', event: 'startup_failed' }));
  process.exitCode = 1;
}
