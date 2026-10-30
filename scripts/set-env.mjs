import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src/environments/environment.ts');

function fromDotEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*API_GATEWAY_URL\s*=\s*(.+?)\s*$/.exec(line);
    if (match) return match[1].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const raw = process.env.API_GATEWAY_URL ?? fromDotEnv();

if (!raw) {
  console.error('[set-env] Falta API_GATEWAY_URL. Exportala o crea un .env con:');
  console.error('[set-env]   API_GATEWAY_URL=https://tu-gateway.onrender.com');
  process.exit(1);
}

let base;
try {
  base = new URL(raw);
} catch {
  console.error('[set-env] API_GATEWAY_URL no es una URL valida: ' + raw);
  process.exit(1);
}

if (base.protocol !== 'https:' && base.protocol !== 'http:') {
  console.error('[set-env] API_GATEWAY_URL debe empezar por https:// (o http:// en local)');
  process.exit(1);
}

const isLocal = base.hostname === 'localhost' || base.hostname === '127.0.0.1';
if (isLocal && (process.env.VERCEL || process.env.CI)) {
  console.error('[set-env] En produccion API_GATEWAY_URL no puede apuntar a localhost (' + raw + ')');
  process.exit(1);
}

const origin = base.origin;
const path = base.pathname.replace(/\/+$/, '');
const apiUrl = path.endsWith('/api/v1') ? origin + path : origin + (path || '') + '/api/v1';
const wsProtocol = base.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = wsProtocol + '://' + base.host + (path.replace(/\/api\/v1$/, '') || '') + '/ws';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  wsUrl: '${wsUrl}',
  useMock: false,
};
`;

writeFileSync(target, content, 'utf8');
console.log('[set-env] apiUrl = ' + apiUrl);
console.log('[set-env] wsUrl  = ' + wsUrl);
