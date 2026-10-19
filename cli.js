#!/usr/bin/env node

/**
 * Skool MCP — CLI router
 *
 *   was-skool-mcp          Start the MCP server (used by AI client via stdio)
 *   was-skool-mcp auth     Connect / re-connect credentials
 *   was-skool-mcp logout   Delete saved credentials
 *   was-skool-mcp status   Show whether credentials are saved and when
 *   was-skool-mcp help     Show usage
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { CONFIG_FILE } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmd = (process.argv[2] || '').toLowerCase();

// EVERY dynamic import() MUST be wrapped in pathToFileURL(...).href
// Otherwise Windows Node 24+ throws ERR_UNSUPPORTED_ESM_URL_SCHEME
if (cmd === 'auth') {
  const { runAuthFlow } = await import(pathToFileURL(join(__dirname, 'auth.js')).href);
  try {
    await runAuthFlow();
    process.exit(0);
  } catch (err) {
    console.error('\nAuth failed:', err?.message || err);
    process.exit(1);
  }
} else if (cmd === 'logout') {
  const { deleteConfigFile } = await import(pathToFileURL(join(__dirname, 'auth.js')).href);
  const deleted = await deleteConfigFile();
  console.log(deleted ? `Removed ${CONFIG_FILE}` : 'No saved credentials to remove.');
  process.exit(0);
} else if (cmd === 'status') {
  const { readConfigFile } = await import(pathToFileURL(join(__dirname, 'auth.js')).href);
  const cfg = await readConfigFile();
  if (!cfg) {
    console.log('Not configured. Run `npx -y github:mnsmasum62786/was-skool-mcp auth` to connect.');
  } else {
    console.log(`Config:            ${CONFIG_FILE}`);
    console.log(`Saved at:          ${cfg.saved_at || '(unknown)'}`);
    console.log(`Default Community: ${cfg.default_community || '(none)'}`);
  }
  process.exit(0);
} else if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`
Skool MCP — CLI

Usage:
  npx -y github:mnsmasum62786/was-skool-mcp          Start MCP server (stdio)
  npx -y github:mnsmasum62786/was-skool-mcp auth     Connect / re-connect
  npx -y github:mnsmasum62786/was-skool-mcp status   Show config summary
  npx -y github:mnsmasum62786/was-skool-mcp logout   Delete credentials
  npx -y github:mnsmasum62786/was-skool-mcp help     This message

Environment variable overrides (take precedence over saved config):
  SKOOL_AUTH_TOKEN             Your Skool auth_token cookie or session cookie string
  SKOOL_DEFAULT_COMMUNITY      Default community slug (e.g. "my-community")
  SKOOL_BASE_URL               Base URL override (defaults to https://www.skool.com)

Requires Node 18+.
`);
  process.exit(0);
} else {
  // Default action: start the MCP stdio server
  await import(pathToFileURL(join(__dirname, 'server.js')).href);
}
