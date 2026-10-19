import { mkdir, writeFile, chmod, readFile, unlink } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_BASE_URL, USER_AGENT } from './config.js';

export async function runAuthFlow() {
  console.log('\n=== Skool MCP — Setup ===\n');
  console.log('To authenticate with Skool, you need your browser session cookie:');
  console.log('  1. Open https://www.skool.com in your web browser and ensure you are logged in.');
  console.log('  2. Open DevTools (F12 or Cmd+Option+I) -> Application -> Cookies -> https://www.skool.com');
  console.log('  3. Copy the value of the "auth_token" cookie.\n');

  let token = process.env.SKOOL_AUTH_TOKEN || process.env.SKOOL_COOKIES;
  let defaultCommunity = process.env.SKOOL_DEFAULT_COMMUNITY;

  const rl = readline.createInterface({ input, output });

  if (!token) {
    token = (await rl.question('Paste your "auth_token" (or full Cookie string): ')).trim();
  }
  if (!defaultCommunity) {
    defaultCommunity = (await rl.question('Default community slug (e.g. "community-slug", optional, press Enter to skip): ')).trim();
  }

  rl.close();

  if (!token) {
    throw new Error('Skool auth_token is required.');
  }

  // Format cookie string properly
  const cookies = token.includes('=') ? token : `auth_token=${token}`;

  console.log('\nVerifying session with Skool...');
  
  const res = await fetch(DEFAULT_BASE_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': cookies,
    },
  });

  if (!res.ok) {
    throw new Error(`Connection failed: HTTP ${res.status}. Please check that your auth_token is valid and not expired.`);
  }

  const html = await res.text();
  const buildMatch = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (!buildMatch) {
    throw new Error('Could not verify Skool session (buildId missing). Ensure your auth_token is correct.');
  }

  let verifiedInfo = `Connected! (Next.js Build ID: ${buildMatch[1]})`;

  if (defaultCommunity) {
    try {
      const commRes = await fetch(`${DEFAULT_BASE_URL}/_next/data/${buildMatch[1]}/${defaultCommunity}.json`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Cookie': cookies,
        },
      });
      if (commRes.ok) {
        const commData = await commRes.json();
        const commName = commData?.pageProps?.group?.name || commData?.pageProps?.community?.name || defaultCommunity;
        verifiedInfo = `Connected to community: "${commName}" (${defaultCommunity})`;
      }
    } catch {}
  }

  console.log(`✓ ${verifiedInfo}`);

  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const payload = {
    cookies,
    default_community: defaultCommunity || null,
    saved_at: new Date().toISOString(),
  };

  await writeFile(CONFIG_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
  try { await chmod(CONFIG_FILE, 0o600); } catch {}

  console.log(`\n✓ Credentials saved to ${CONFIG_FILE}\n`);
  console.log('Add this configuration to your AI client:\n');
  console.log(JSON.stringify({
    mcpServers: {
      'Skool MCP': {
        command: 'npx',
        args: ['-y', 'github:mnsmasum62786/was-skool-mcp'],
      },
    },
  }, null, 2));
}

export async function readConfigFile() {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export async function deleteConfigFile() {
  try {
    await unlink(CONFIG_FILE);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}
