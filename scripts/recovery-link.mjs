/**
 * Buat tautan reset kata sandi TANPA mengirim email.
 *
 *   node scripts/recovery-link.mjs nama@email.com
 *   node scripts/recovery-link.mjs nama@email.com --url https://tokoku.example.com
 *
 * Gunanya untuk menguji alur lupa/atur sandi tanpa perlu membuka kotak masuk —
 * di development, email seed memakai domain yang tidak ada (@tokodewi.id), jadi
 * tautannya tidak akan pernah sampai ke mana pun.
 *
 * Yang dicetak adalah tautan yang setara dengan isi email sungguhan. Buka di
 * browser, dan alurnya berjalan persis seperti user biasa: /auth/konfirmasi
 * memasang sesi pemulihan lalu melempar ke /atur-sandi.
 *
 * Tautannya sekali pakai dan berlaku 1 jam — sama seperti dari email.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith('--'))
const urlFlag = args.indexOf('--url')
const appUrl = (urlFlag !== -1 ? args[urlFlag + 1] : null) ?? env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

if (!email) {
  console.error('Pakai: node scripts/recovery-link.mjs nama@email.com [--url https://…]')
  process.exit(1)
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data, error } = await db.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo: `${appUrl}/auth/konfirmasi?next=/atur-sandi` },
})

if (error) {
  console.error(`✗ Gagal membuat tautan untuk ${email}: ${error.message}`)
  process.exit(1)
}

const local = `${appUrl}/auth/konfirmasi?token_hash=${data.properties.hashed_token}&type=recovery&next=/atur-sandi`

console.log(`\n  Tautan reset kata sandi untuk ${email}`)
console.log(`  Sekali pakai · berlaku 1 jam\n`)
console.log(`  Buka ini di browser:\n  ${local}\n`)
console.log(`  (Versi lewat Supabase, seperti isi email asli:)\n  ${data.properties.action_link}\n`)
