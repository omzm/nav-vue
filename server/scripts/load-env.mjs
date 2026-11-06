import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load before the application: env.ts snapshots process.env at import time.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
