/**
 * Jadikan seorang user sebagai Super Admin platform.
 *
 *   node scripts/grant-platform-admin.mjs nama@email.com
 *   node scripts/grant-platform-admin.mjs nama@email.com --revoke
 *   node scripts/grant-platform-admin.mjs --list
 *
 * Sengaja lewat skrip, bukan lewat halaman di aplikasi: hak platform tidak boleh
 * bisa diberikan dari dalam aplikasi oleh siapa pun. Menjalankan skrip ini butuh
 * SUPABASE_SERVICE_ROLE_KEY, yang hanya dipegang orang yang memang mengelola project.
 *
 * User-nya harus sudah ada lebih dulu (Dashboard → Authentication → Users → Add user,
 * atau lewat halaman daftar aplikasi).
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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const list = args.includes('--list')
const email = args.find((a) => !a.startsWith('--'))

async function listAdmins() {
  const { data, error } = await db.from('platform_admins').select('user_id, granted_at')
  if (error) throw error
  if (!data.length) return console.log('Belum ada Super Admin.')

  const { data: auth } = await db.auth.admin.listUsers({ perPage: 200 })
  console.log('Super Admin saat ini:')
  for (const a of data) {
    const u = auth.users.find((x) => x.id === a.user_id)
    console.log(`  ${u?.email ?? a.user_id}  (sejak ${new Date(a.granted_at).toLocaleDateString('id-ID')})`)
  }
}

async function main() {
  if (list || !email) {
    await listAdmins()
    if (!email) {
      console.log('\nPakai: node scripts/grant-platform-admin.mjs <email> [--revoke]')
    }
    return
  }

  const { data: auth, error: authErr } = await db.auth.admin.listUsers({ perPage: 200 })
  if (authErr) throw authErr

  const user = auth.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`✗ User ${email} belum ada.`)
    console.error('  Buat dulu di Dashboard → Authentication → Users → Add user.')
    process.exit(1)
  }

  if (revoke) {
    const { error } = await db.from('platform_admins').delete().eq('user_id', user.id)
    if (error) throw error
    console.log(`✓ Hak Super Admin dicabut dari ${email}`)
  } else {
    const { error } = await db
      .from('platform_admins')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
    if (error) throw error
    console.log(`✓ ${email} sekarang Super Admin`)
    console.log('  Login ulang agar peran barunya terbaca.')
  }

  console.log()
  await listAdmins()
}

main().catch((e) => {
  console.error('\n✗', e.message ?? e)
  process.exit(1)
})
