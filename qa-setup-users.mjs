/**
 * Setup QA: crea los usuarios de prueba vía signup de GoTrue — el hash bcrypt,
 * la identidad y el registro interno los genera el propio servicio de auth.
 * La confirmación de email se aplica después por SQL (paso 2, equivalente al
 * botón "Confirmar usuario" del dashboard, sin enviar correos).
 *
 * Uso: node qa-setup-users.mjs   (desde AIRSTARK/)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { qaEnv } from './qa-env.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, detectSessionInUrl: false },
});

const { emailA, emailB, password } = qaEnv();
const usuarios = [
  { email: emailA, name: 'Profesor QA A' },
  { email: emailB, name: 'Profesor QA B' },
];

for (const u of usuarios) {
  const { data, error } = await sb.auth.signUp({
    email: u.email,
    password,
    options: { data: { name: u.name } },
  });
  if (error) {
    // Si ya existe, GoTrue devuelve "User already registered" → suficiente.
    if (/already|exists/i.test(error.message)) {
      console.log(`SKIP  ${u.email} ya existe (${error.message})`);
    } else {
      console.log(`ERROR ${u.email}: ${error.status ?? ''} ${error.message}`);
      process.exitCode = 1;
    }
  } else {
    console.log(`OK    ${u.email} creado (uid=${data.user?.id}, sesión=${data.session ? 'sí' : 'no, pendiente confirmar'})`);
  }
}
