/**
 * Pensiunkan tenant demo dari database PRODUKSI.
 *
 *   node scripts/retire-demo.mjs                 # kering — cuma melapor, tidak mengubah apa pun
 *   node scripts/retire-demo.mjs --confirm       # kerjakan sungguhan
 *   node scripts/retire-demo.mjs --confirm --only "Toko Dewi"
 *
 * ============================================================================
 * KENAPA INI PERLU
 *
 * Data demo dibuat di database yang SAMA dengan tempat klien asli nanti
 * tinggal. Selama belum ada klien itu tidak berbahaya; begitu ada, dua hal
 * menggigit sekaligus:
 *
 * 1. Akun demo memakai sandi bersama yang tertulis apa adanya di dalam repo
 *    (`TokoKu123!`). Sudah dibuktikan 13 Agu: login ke produksi menjawab 200.
 *    Satu akun bocor jadi pintu ke sistem yang juga menyimpan data orang lain.
 * 2. Dashboard Super Admin MENJUMLAHKAN omset seluruh klien. Selama toko demo
 *    masih terhitung, angka bisnis pemilik platform sendiri tercampur data
 *    karangan sejak hari pertama.
 *
 * ============================================================================
 * KENAPA SKRIP, BUKAN TOMBOL DI APLIKASI
 *
 * Sama dengan `grant-platform-admin.mjs`: butuh SUPABASE_SERVICE_ROLE_KEY, yang
 * hanya dipegang orang yang memang mengelola project. Menghapus tenant tidak
 * boleh pernah bisa dipicu dari dalam aplikasi oleh siapa pun.
 *
 * ============================================================================
 * YANG DIKERJAKAN, DAN APA YANG SENGAJA TIDAK
 *
 * - **Salinan JSON ditulis lebih dulu**, sebelum satu baris pun berubah.
 *   Supabase paket gratis TIDAK punya point-in-time recovery, jadi tanpa ini
 *   tidak ada jalan pulang sama sekali kalau ternyata salah toko.
 * - **SOFT delete** (`deleted_at`), bukan DELETE sungguhan. Tokonya hilang dari
 *   setiap halaman dan dari semua penjumlahan, tapi barisnya masih ada kalau
 *   suatu saat perlu dilihat lagi. DELETE sungguhan meng-cascade ke transaksi,
 *   stok, dan ledger — tidak ada yang bisa mengembalikannya.
 * - **Sandi akun demo diacak.** Ini inti keamanannya: yang berbahaya bukan
 *   tokonya, melainkan sandi yang tertulis di repo dan berlaku di produksi.
 * - **Super Admin TIDAK PERNAH disentuh.** Diperiksa terhadap `platform_admins`
 *   sebelum apa pun dikerjakan.
 * - **Akun yang juga anggota toko NON-demo tidak disentuh.** Kalau suatu hari
 *   email yang sama dipakai membantu klien asli, mengacak sandinya berarti
 *   mengunci orang itu keluar dari toko yang sungguhan.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
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
const confirm = args.includes('--confirm')
const onlyIdx = args.indexOf('--only')
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null

/** Nama toko demo yang dibuat `seed-demo.mjs` dan pengujian multi-toko. */
const DEMO = ['Toko Dewi', 'Warung Rina', 'Warung Barokah']
const target = only ? [only] : DEMO

const log = (...a) => console.log(...a)
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

async function main() {
  log(confirm ? '● MODE SUNGGUHAN\n' : '○ MODE KERING — tidak ada yang diubah. Tambah --confirm untuk mengerjakan.\n')

  const { data: orgs, error } = await db
    .from('organizations')
    .select('id, name, city, status, deleted_at')
    .in('name', target)

  if (error) {
    console.error('✗ Gagal membaca daftar toko:', error.message)
    process.exit(1)
  }
  if (!orgs?.length) {
    log('Tidak ada toko demo yang cocok. Sudah bersih.')
    return
  }

  // Super Admin dikumpulkan sekali di depan, lalu dipakai sebagai daftar
  // larangan di seluruh proses.
  const { data: admins } = await db.from('platform_admins').select('user_id')
  const adminIds = new Set((admins ?? []).map((a) => a.user_id))

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = new URL(`../backup-demo-${stamp}/`, import.meta.url)
  if (confirm) mkdirSync(dir, { recursive: true })

  for (const org of orgs) {
    log(`\n── ${org.name} (${org.city ?? '-'}) · ${org.status}`)
    if (org.deleted_at) {
      log('   sudah dihapus sebelumnya, dilewati.')
      continue
    }

    // ---- hitung isinya, supaya keputusannya diambil dengan angka ----
    const hitung = async (tabel) => {
      const { count } = await db
        .from(tabel)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id)
      return count ?? 0
    }
    const [produk, transaksi, pelanggan] = await Promise.all([
      hitung('products'),
      hitung('transactions'),
      hitung('customers'),
    ])
    const { data: omset } = await db
      .from('transactions')
      .select('total')
      .eq('organization_id', org.id)
      .eq('status', 'paid')
    const total = (omset ?? []).reduce((s, t) => s + Number(t.total ?? 0), 0)

    log(`   ${produk} produk · ${transaksi} transaksi · ${pelanggan} pelanggan · ${rp(total)} omset`)

    // ---- anggota ----
    const { data: members } = await db
      .from('organization_members')
      .select('user_id, role, profiles:user_id(full_name)')
      .eq('organization_id', org.id)

    const kandidat = []
    for (const m of members ?? []) {
      if (adminIds.has(m.user_id)) {
        log(`   ! ${m.user_id} adalah Super Admin — sandinya TIDAK disentuh`)
        continue
      }
      // Anggota toko lain yang BUKAN demo? Jangan dikunci.
      /**
       * `deleted_at is null` WAJIB di sini.
       *
       * Tanpa itu, toko sisa pengujian yang sudah lama di-soft-delete tetap
       * terhitung sebagai "toko asli" dan akunnya dilewati — yaitu persis akun
       * yang paling perlu diamankan. Ketahuan saat uji kering 13 Agu: dua baris
       * "Uji Trial Bersama" yang sudah dihapus membuat sandi pemilik Toko Dewi
       * tidak jadi diacak.
       */
      const { data: lain } = await db
        .from('organization_members')
        .select('organization_id, organizations:organization_id(name, deleted_at)')
        .eq('user_id', m.user_id)
        .neq('organization_id', org.id)
      /**
       * PostgREST mengembalikan relasi tertanam sebagai ARRAY, bukan objek.
       * Dibaca sebagai objek, `x.organizations?.name` selalu undefined dan
       * SETIAP akun terbaca "punya toko asli" — yang artinya tidak ada satu
       * sandi pun yang diacak, padahal itu inti keamanan skrip ini. Gagal ke
       * arah yang tampak aman justru yang paling berbahaya di sini.
       */
      const orgDari = (x) => {
        const o = x.organizations
        return Array.isArray(o) ? o[0] : o
      }
      const punyaTokoAsli = (lain ?? []).some((x) => {
        const o = orgDari(x)
        // Relasi tidak terbaca — jangan ditebak aman.
        if (!o?.name) throw new Error(`Toko ${x.organization_id} tidak terbaca; hentikan.`)
        if (o.deleted_at) return false
        return !DEMO.includes(o.name)
      })
      if (punyaTokoAsli) {
        log(`   ! ${m.user_id} juga anggota toko non-demo — sandinya TIDAK disentuh`)
        continue
      }
      kandidat.push(m)
    }

    if (!confirm) {
      log(`   → akan di-soft-delete, dan ${kandidat.length} sandi akun diacak`)
      continue
    }

    // ---- salinan JSON DULU, sebelum apa pun berubah ----
    const salinan = {}
    for (const t of [
      'products',
      'categories',
      'customers',
      'transactions',
      'transaction_items',
      'outlets',
      'organization_members',
    ]) {
      const { data } = await db.from(t).select('*').eq('organization_id', org.id)
      salinan[t] = data ?? []
    }
    salinan.organization = org
    const berkas = new URL(`${org.name.replace(/[^a-zA-Z0-9]+/g, '-')}.json`, dir)
    writeFileSync(berkas, JSON.stringify(salinan, null, 2))
    log(`   ✓ salinan ditulis: ${berkas.pathname.split('/').slice(-2).join('/')}`)

    // ---- acak sandi ----
    for (const m of kandidat) {
      const baru = randomBytes(24).toString('base64url')
      const { error: e } = await db.auth.admin.updateUserById(m.user_id, { password: baru })
      const nama = m.profiles?.full_name ?? m.user_id
      if (e) log(`   ✗ sandi ${nama} gagal diacak: ${e.message}`)
      else log(`   ✓ sandi ${nama} diacak (tidak disimpan di mana pun — memang tidak untuk dipakai lagi)`)
    }

    // ---- soft delete ----
    const { error: e2 } = await db
      .from('organizations')
      .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
      .eq('id', org.id)
    if (e2) log(`   ✗ gagal menghapus toko: ${e2.message}`)
    else log('   ✓ toko di-soft-delete dan dinonaktifkan')
  }

  log(
    confirm
      ? '\nSelesai. Periksa /admin — angka total sekarang seharusnya hanya berisi klien asli.'
      : '\nJalankan ulang dengan --confirm kalau daftar di atas sudah benar.',
  )
}

main().catch((e) => {
  console.error('✗', e)
  process.exit(1)
})
