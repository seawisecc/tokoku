/**
 * Isi toko peninjauan Midtrans dengan data contoh.
 *
 *   node scripts/seed-review-tenant.mjs "Toko Contoh Midtrans"
 *   node scripts/seed-review-tenant.mjs "Toko Contoh Midtrans" --dry
 *
 * Dipakai sekali, setelah toko peninjauan didaftarkan sendiri lewat
 * /daftar-toko. Tanpa ini reviewer Midtrans mendarat di Beranda "Rp 0" dengan
 * empat kartu bernilai nol, Kasir tanpa satu pun produk, dan Laporan kosong —
 * dan aplikasi yang tampak kosong sulit dibedakan dari aplikasi yang belum jadi.
 *
 * TOKONYA HARUS SUDAH ADA. Skrip ini sengaja TIDAK membuat akun: pembuatan akun
 * butuh kata sandi, dan di project ini tidak ada satu pun kata sandi yang boleh
 * tersimpan di repo (lihat "Kredensial" di CLAUDE.md). Daftarkan tokonya lewat
 * layar, lalu jalankan ini.
 *
 * Memakai service_role (melewati RLS) karena ini jalur provisioning, sama dengan
 * seed-demo.mjs. Aman dijalankan berulang: tiap langkah memeriksa dulu.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const NAMA = args.find((a) => !a.startsWith('--')) ?? 'Toko Contoh Midtrans'

const log = (...a) => console.log(' ', ...a)
const die = (label, error) => {
  if (error) {
    console.error(`\n✗ ${label}:`, error.message ?? error)
    process.exit(1)
  }
}

/**
 * Toko yang TIDAK BOLEH disentuh skrip ini, dicocokkan per nama.
 *
 * Toko Dewi dipakai pemilik project untuk memperagakan aplikasi ke calon klien,
 * dan setelannya (poin loyalty, batas diskon, satu produk berpromo) sengaja
 * disetel tangan. Leuca de Perfume tenant hidup milik pemilik project sendiri.
 * Menambahkan 12 produk contoh ke salah satunya akan merusak peragaan tanpa ada
 * yang menyadarinya sampai peragaan berikutnya berjalan.
 */
const DILINDUNGI = ['toko dewi', 'leuca de perfume']

const KATEGORI = ['Sembako', 'Minuman', 'Snack', 'Kebutuhan']

// sku, nama, kategori, hpp, harga jual, stok awal, barcode
const PRODUK = [
  ['SMB-0001', 'Beras Pandan Wangi 5kg', 'Sembako', 62000, 71000, 24, null],
  ['SMB-0002', 'Minyak Goreng 2L', 'Sembako', 32000, 36500, 40, '8992775311011'],
  ['SMB-0003', 'Gula Pasir 1kg', 'Sembako', 14500, 17000, 55, null],
  ['SMB-0004', 'Telur Ayam 1kg', 'Sembako', 26000, 29500, 18, null],
  ['MNM-0005', 'Air Mineral 600ml', 'Minuman', 2400, 3500, 120, '8886008101053'],
  ['MNM-0006', 'Teh Kotak 250ml', 'Minuman', 3200, 5000, 84, '8992745700015'],
  ['MNM-0007', 'Kopi Sachet (Renceng)', 'Minuman', 11000, 14000, 36, null],
  ['SNK-0008', 'Keripik Kentang 68g', 'Snack', 8500, 11000, 42, null],
  ['SNK-0009', 'Biskuit Kaleng 275g', 'Snack', 24000, 29000, 9, null],
  ['KBT-0010', 'Sabun Mandi Batang', 'Kebutuhan', 3200, 4500, 96, null],
  ['KBT-0011', 'Deterjen Bubuk 800g', 'Kebutuhan', 18500, 22000, 27, null],
  ['KBT-0012', 'Tisu Wajah 250 lembar', 'Kebutuhan', 12000, 15500, 6, null],
]

/**
 * Transaksi disebar ke BEBERAPA HARI ke belakang, bukan ditumpuk hari ini.
 *
 * Grafik harian di Laporan adalah salah satu layar yang paling menunjukkan
 * aplikasinya hidup, dan grafik dengan satu batang terbaca seperti grafik yang
 * rusak. Tujuh hari memberi bentuk tanpa harus mengarang data sebulan.
 *
 * hariKeBelakang, jam, metode, [[sku, qty], ...]
 */
const TRANSAKSI = [
  [6, '08:24', 'cash',     [['SMB-0002', 1], ['MNM-0005', 2]]],
  [6, '11:07', 'qris',     [['SNK-0008', 2], ['MNM-0006', 3]]],
  [5, '09:15', 'cash',     [['SMB-0001', 1], ['SMB-0003', 2]]],
  [5, '16:42', 'qris',     [['KBT-0010', 3], ['KBT-0012', 1]]],
  [4, '10:33', 'cash',     [['SMB-0004', 2], ['MNM-0007', 1]]],
  [3, '08:51', 'transfer', [['SMB-0001', 2], ['SMB-0002', 2], ['SMB-0003', 3]]],
  [3, '13:20', 'cash',     [['MNM-0005', 6]]],
  [2, '09:48', 'qris',     [['SNK-0009', 1], ['SNK-0008', 2], ['MNM-0006', 2]]],
  [2, '15:11', 'cash',     [['KBT-0011', 1], ['KBT-0010', 2]]],
  [1, '08:36', 'cash',     [['SMB-0003', 1], ['MNM-0007', 2]]],
  [1, '12:05', 'qris',     [['SMB-0002', 1], ['SNK-0008', 1], ['MNM-0005', 3]]],
  [1, '17:29', 'cash',     [['KBT-0012', 2], ['MNM-0006', 1]]],
  [0, '09:02', 'cash',     [['SMB-0004', 1], ['MNM-0005', 2]]],
  [0, '11:44', 'qris',     [['SNK-0008', 3], ['MNM-0006', 2], ['KBT-0010', 1]]],
]

const PELANGGAN = { name: 'Siti Rahayu', phone: '6281234567890' }

console.log(`\nToko peninjauan: "${NAMA}"${DRY ? '  (UJI KERING, tidak menulis apa pun)' : ''}\n`)

if (DILINDUNGI.includes(NAMA.toLowerCase())) {
  console.error(`✗ "${NAMA}" adalah toko yang dilindungi. Skrip ini hanya untuk toko peninjauan.`)
  process.exit(1)
}

// ---------- 1. temukan tokonya ----------
const { data: orgs, error: orgErr } = await db
  .from('organizations')
  .select('id, name, status, deleted_at')
  .ilike('name', NAMA)
die('mencari toko', orgErr)

const hidup = (orgs ?? []).filter((o) => !o.deleted_at)
if (hidup.length === 0) {
  console.error(`✗ Toko "${NAMA}" tidak ditemukan.`)
  console.error('  Daftarkan dulu lewat https://tokoku.seawise.id/daftar-toko, konfirmasi')
  console.error('  emailnya, lalu masuk sekali supaya tokonya benar-benar terbentuk.')
  process.exit(1)
}
if (hidup.length > 1) {
  console.error(`✗ Ada ${hidup.length} toko bernama "${NAMA}". Bedakan namanya dulu.`)
  process.exit(1)
}

const org = hidup[0]
const orgId = org.id
log(`toko ditemukan: ${org.name} (${org.status})`)

const { data: outlet } = await db
  .from('outlets')
  .select('id, name, code')
  .eq('organization_id', orgId)
  .order('is_primary', { ascending: false })
  .limit(1)
  .maybeSingle()
if (!outlet) die('outlet', new Error('Toko ini belum punya outlet.'))
log(`outlet: ${outlet.name} (${outlet.code})`)

const { data: member } = await db
  .from('organization_members')
  .select('user_id, role')
  .eq('organization_id', orgId)
  .eq('status', 'active')
  .order('role')
  .limit(1)
  .maybeSingle()
if (!member) die('anggota', new Error('Toko ini belum punya anggota aktif.'))

if (DRY) {
  console.log('\nYang AKAN dikerjakan:')
  console.log(`  kategori   : ${KATEGORI.join(', ')}`)
  console.log(`  produk     : ${PRODUK.length} item, 3 di antaranya berbarcode EAN-13`)
  console.log(`  stok awal  : total ${PRODUK.reduce((s, p) => s + p[5], 0)} satuan`)
  console.log(`  pelanggan  : ${PELANGGAN.name}`)
  console.log(`  transaksi  : ${TRANSAKSI.length} nota tersebar 7 hari ke belakang`)
  console.log('\nJalankan tanpa --dry untuk benar-benar menulis.\n')
  process.exit(0)
}

// ---------- 2. kategori ----------
const { data: catsAda } = await db.from('categories').select('id, name').eq('organization_id', orgId)
const catId = Object.fromEntries((catsAda ?? []).map((c) => [c.name, c.id]))
const catKurang = KATEGORI.filter((k) => !catId[k])
if (catKurang.length) {
  const { data, error } = await db
    .from('categories')
    .insert(catKurang.map((name, i) => ({ organization_id: orgId, name, color_key: ['lime', 'mint', 'blue', 'amber'][i % 4] })))
    .select('id, name')
  die('menambah kategori', error)
  for (const c of data) catId[c.name] = c.id
}
log(`kategori: ${KATEGORI.length} siap (${catKurang.length} baru)`)

// ---------- 3. produk ----------
const { data: prodAda } = await db.from('products').select('sku').eq('organization_id', orgId)
const known = new Set((prodAda ?? []).map((p) => p.sku))
const baru = PRODUK.filter(([sku]) => !known.has(sku))
if (baru.length) {
  const { error } = await db.from('products').insert(
    baru.map(([sku, name, cat, cost, price, , barcode]) => ({
      organization_id: orgId,
      category_id: catId[cat],
      sku,
      name,
      barcode,
      cost_price: cost,
      sell_price: price,
      min_stock: 10,
    })),
  )
  die('menambah produk', error)
}
log(`produk: ${PRODUK.length} item (${baru.length} baru)`)

// ---------- 4. stok awal ----------
// Penanda selesai adalah ada/tidaknya movement 'initial', bukan ada/tidaknya
// produk — supaya seed yang gagal di tengah bisa diselesaikan dengan mengulang.
const { data: semuaProduk } = await db
  .from('products')
  .select('id, sku, name, sell_price')
  .eq('organization_id', orgId)
const { data: moveAwal } = await db
  .from('stock_movements')
  .select('product_id')
  .eq('organization_id', orgId)
  .eq('type', 'initial')
const sudahStok = new Set((moveAwal ?? []).map((m) => m.product_id))

let diisi = 0
for (const p of semuaProduk) {
  if (sudahStok.has(p.id)) continue
  const qty = PRODUK.find(([sku]) => sku === p.sku)?.[5]
  if (qty === undefined) continue

  die(`stok awal ${p.sku}`, (await db.from('product_stocks').upsert(
    { organization_id: orgId, product_id: p.id, outlet_id: outlet.id, quantity: qty },
    { onConflict: 'product_id,outlet_id' },
  )).error)
  die(`movement ${p.sku}`, (await db.from('stock_movements').insert({
    organization_id: orgId, outlet_id: outlet.id, product_id: p.id,
    type: 'initial', quantity_delta: qty, balance_after: qty,
    note: 'Stok awal (data contoh)',
  })).error)
  diisi++
}
log(`stok awal: diisi untuk ${diisi} produk`)

// ---------- 5. perangkat kasir ----------
let { data: device } = await db
  .from('devices').select('id').eq('outlet_id', outlet.id).eq('code', 'K1').maybeSingle()
if (!device) {
  const { data, error } = await db
    .from('devices')
    .insert({ organization_id: orgId, outlet_id: outlet.id, code: 'K1', name: 'Kasir Depan' })
    .select('id').single()
  die('mendaftarkan perangkat', error)
  device = data
}
log('perangkat POS: K1 — Kasir Depan')

// ---------- 6. pelanggan ----------
const { data: custAda } = await db
  .from('customers').select('id').eq('organization_id', orgId).eq('phone', PELANGGAN.phone).maybeSingle()
if (!custAda) {
  die('menambah pelanggan', (await db.from('customers').insert({
    organization_id: orgId, name: PELANGGAN.name, phone: PELANGGAN.phone,
  })).error)
}
log(`pelanggan: ${PELANGGAN.name}`)

// ---------- 7. transaksi ----------
const { count: trxAda } = await db
  .from('transactions').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)

if (trxAda) {
  log(`transaksi: ${trxAda} sudah ada, dilewati`)
} else {
  const bySku = Object.fromEntries(semuaProduk.map((p) => [p.sku, p]))
  let seq = 1
  for (const [mundur, jam, metode, baris] of TRANSAKSI) {
    const tgl = new Date(Date.now() - mundur * 864e5).toISOString().slice(0, 10)
    const items = baris.map(([sku, qty]) => ({
      product_id: bySku[sku].id,
      product_name: bySku[sku].name,
      sku,
      quantity: qty,
      unit_price: bySku[sku].sell_price,
    }))
    const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

    // `client_created_at` yang menentukan tanggal di seluruh laporan, bukan
    // `created_at` — lihat "Aturan yang tidak boleh dilanggar" di CLAUDE.md.
    const { error } = await db.rpc('_apply_transaction', {
      p_org: orgId,
      p_origin: 'online',
      p_cashier: member.user_id,
      p_trx: {
        code: `TRX-${tgl.replaceAll('-', '')}-K1-${String(seq++).padStart(4, '0')}`,
        outlet_id: outlet.id,
        device_id: device.id,
        client_created_at: `${tgl}T${jam}:00+08:00`,
        payment_method: metode,
        paid_amount: metode === 'cash' ? Math.ceil(total / 5000) * 5000 : total,
        items,
      },
    })
    die(`transaksi ${tgl} ${jam}`, error)
  }
  log(`transaksi: ${TRANSAKSI.length} nota tersebar 7 hari`)
}

// ---------- ringkasan ----------
const { data: sales } = await db
  .from('v_daily_sales')
  .select('sales_date, revenue, transaction_count')
  .eq('organization_id', orgId)
  .order('sales_date', { ascending: false })
const omset = (sales ?? []).reduce((s, r) => s + Number(r.revenue ?? 0), 0)
const nota = (sales ?? []).reduce((s, r) => s + Number(r.transaction_count ?? 0), 0)

console.log('\n✓ Toko peninjauan siap ditelusuri')
console.log('  Hari berpenjualan :', (sales ?? []).length)
console.log('  Total omset       : Rp ' + omset.toLocaleString('id-ID'))
console.log('  Total nota        :', nota)
console.log('\n  Yang perlu diperiksa sendiri sebelum kredensialnya dikirim:')
console.log('    - Beranda tidak lagi menampilkan Rp 0')
console.log('    - Kasir menampilkan grid produk dan pemindai barcode bekerja')
console.log('    - Laporan menampilkan grafik beberapa hari, bukan satu batang')
console.log('    - Pengaturan → Langganan menampilkan tombol Bayar Sekarang\n')
