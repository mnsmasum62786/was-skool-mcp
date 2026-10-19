import { homedir } from 'node:os';
import { join } from 'node:path';

export const CONFIG_DIR = join(homedir(), '.was-skool-mcp');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const DEFAULT_BASE_URL = 'https://www.skool.com';
export const DEFAULT_API2_URL = 'https://api2.skool.com';

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
