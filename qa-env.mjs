/**
 * qa-env.mjs — Cargador compartido de credenciales QA (sin secretos hardcodeados).
 *
 * Prioridad: variables de entorno del proceso → archivo `.env.qa` local
 * (ignorado por git; ver `.env.qa.example`). Los scripts QA fallan con mensaje
 * claro si faltan, en vez de llevar passwords en el código.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(path) {
  const out = {};
  for (const l of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!l || l.trim().startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

let fileEnv = {};
for (const f of ['.env.qa', '.env.local']) {
  const p = join(root, f);
  if (existsSync(p)) fileEnv = { ...parseEnvFile(p), ...fileEnv };
}

export function qaEnv() {
  const emailA = process.env.AIRSTARK_QA_EMAIL_A || fileEnv.AIRSTARK_QA_EMAIL_A;
  const emailB = process.env.AIRSTARK_QA_EMAIL_B || fileEnv.AIRSTARK_QA_EMAIL_B;
  const password = process.env.AIRSTARK_QA_PASSWORD || fileEnv.AIRSTARK_QA_PASSWORD;
  if (!emailA || !emailB || !password) {
    console.error(
      'FATAL: faltan credenciales QA. Define AIRSTARK_QA_EMAIL_A / AIRSTARK_QA_EMAIL_B / ' +
      'AIRSTARK_QA_PASSWORD en entorno o en `.env.qa` (ver `.env.qa.example`).'
    );
    process.exit(2);
  }
  return { emailA, emailB, password };
}
