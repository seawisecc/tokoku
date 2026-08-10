/**
 * Seed data demo TokoKu — Toko Dewi, isinya persis dari REFERENCE-wireframe.html.
 *
 *   node scripts/seed-demo.mjs
 *
 * Memakai service_role (melewati RLS) karena provisioning memang operasi lintas
 * tenant. Aman dijalankan berulang: setiap langkah memeriksa dulu sebelum menulis.
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

const log = (...a) => console.log(' ', ...a)
const die = (label, error) => {
  if (error) {
    console.error(`\n✗ ${label}:`, error.message ?? error)
    process.exit(1)
  }
}

const USERS = {
  owner: 'rina@tokodewi.id',
  admin: 'agus@tokodewi.id',
  cashier1: 'nanda@tokodewi.id',
  cashier2: 'melati@tokodewi.id',
  platform: 'admin@tokoku.id',
}

const PRODUCTS = [
  ['SMB-0001', 'Minyak Goreng Sania 2L', 'Sembako', 18000, 21000, 42],
  ['SMB-0002', 'Beras Rojolele 5kg', 'Sembako', 62000, 68000, 8],
  ['SMB-0003', 'Indomie Goreng (Dus 40)', 'Sembako', 88000, 104000, 26],
  ['KHR-0004', 'Sabun Lifebuoy 85g', 'Kebutuhan', 3500, 4500, 120],
  ['MNM-0005', 'Aqua 600ml (Dus)', 'Minuman', 42000, 50000, 33],
  ['SNK-0006', 'Chitato Kentang 68g', 'Snack', 8500, 10000, 6],
  ['MNM-0007', 'Teh Pucuk 350ml', 'Minuman', 3800, 5000, 64],
  ['KHR-0008', 'Deterjen Rinso 800g', 'Kebutuhan', 14500, 17000, 19],
]

// Transaksi dari wireframe: [jam, kasir, metode, [[sku, qty], …]]
const TRANSACTIONS = [
  ['09:47', 'cashier2', 'qris', [['SMB-0001', 2], ['MNM-0007', 4], ['SNK-0006', 1], ['KHR-0004', 2]]],
  ['10:31', 'cashier1', 'cash', [['MNM-0005', 1], ['KHR-0008', 1]]],
  ['10:58', 'cashier1', 'qris', [['SMB-0002', 1], ['SMB-0001', 2], ['MNM-0007', 2], ['SNK-0006', 2], ['KHR-0004', 1]]],
  ['11:20', 'cashier2', 'cash', [['SMB-0001', 1]]],
  ['11:42', 'cashier1', 'qris', [['SMB-0003', 1], ['MNM-0005', 1], ['KHR-0004', 3]]],
]

async function main() {
  // ---------- 1. user id ----------
  const { data: authList, error: authErr } = await db.auth.admin.listUsers({ perPage: 200 })
  die('membaca daftar user', authErr)
  const idOf = (email) => {
    const u = authList.users.find((x) => x.email === email)
    if (!u) die(`user ${email} belum ada`, new Error('jalankan pembuatan user dulu'))
    return u.id
  }
  const uid = Object.fromEntries(Object.entries(USERS).map(([k, v]) => [k, idOf(v)]))
  log(`${Object.keys(uid).length} user ditemukan`)

  // ---------- 2. super admin ----------
  die(
    'menandai platform admin',
    (await db.from('platform_admins').upsert({ user_id: uid.platform }, { onConflict: 'user_id' }))
      .error,
  )
  log('platform admin: admin@tokoku.id')

  // ---------- 3. organisasi ----------
  let { data: org } = await db.from('organizations').select('id').eq('slug', 'toko-dewi').maybeSingle()

  if (!org) {
    const { data: newId, error } = await db.rpc('provision_organization', {
      p_name: 'Toko Dewi',
      p_city: 'Denpasar',
      p_owner: uid.owner,
      p_plan_code: 'growth',
    })
    die('provision_organization', error)
    org = { id: newId }
    log('organisasi dibuat: Toko Dewi')
  } else {
    log('organisasi sudah ada: Toko Dewi')
  }

  const orgId = org.id
  await db.from('organizations').update({ status: 'active' }).eq('id', orgId)

  const { data: outlet } = await db
    .from('outlets')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_primary', true)
    .single()
  const outletId = outlet.id

  // ---------- 4. tim ----------
  const team = [
    { user_id: uid.admin, role: 'admin', permissions: { pos: true, products: true, reports: true, settings: false } },
    { user_id: uid.cashier1, role: 'cashier', permissions: { pos: true, products: false, reports: false, settings: false } },
    { user_id: uid.cashier2, role: 'cashier', permissions: { pos: true, products: false, reports: false, settings: false } },
  ]
  die(
    'menambah anggota tim',
    (
      await db.from('organization_members').upsert(
        team.map((t) => ({ ...t, organization_id: orgId, default_outlet_id: outletId, status: 'active' })),
        { onConflict: 'organization_id,user_id' },
      )
    ).error,
  )
  log(`tim: ${team.length + 1} anggota (1 pemilik, 1 admin, 2 kasir)`)

  // ---------- 5. perangkat POS ----------
  let { data: device } = await db
    .from('devices')
    .select('id')
    .eq('outlet_id', outletId)
    .eq('code', 'K1')
    .maybeSingle()
  if (!device) {
    const { data, error } = await db
      .from('devices')
      .insert({ organization_id: orgId, outlet_id: outletId, code: 'K1', name: 'Kasir Depan' })
      .select('id')
      .single()
    die('mendaftarkan perangkat', error)
    device = data
  }
  log('perangkat POS: K1 — Kasir Depan')

  // ---------- 6. produk ----------
  const { data: cats } = await db.from('categories').select('id, name').eq('organization_id', orgId)
  const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]))

  const { data: existing } = await db.from('products').select('sku').eq('organization_id', orgId)
  const known = new Set((existing ?? []).map((p) => p.sku))
  const toInsert = PRODUCTS.filter(([sku]) => !known.has(sku))

  if (toInsert.length) {
    const { error } = await db.from('products').insert(
      toInsert.map(([sku, name, cat, cost, price]) => ({
        organization_id: orgId,
        category_id: catId[cat],
        sku,
        name,
        cost_price: cost,
        sell_price: price,
      })),
    )
    die('menambah produk', error)
  }

  // Stok awal diurus TERPISAH dari insert produk, supaya seed yang gagal di
  // tengah tetap bisa diselesaikan dengan menjalankan ulang. Penanda selesai
  // adalah ada/tidaknya movement bertipe 'initial', bukan ada/tidaknya produk.
  //
  // Ditulis langsung, bukan lewat adjust_stock(): RPC itu memakai auth.uid()
  // untuk cek izin dan service_role tidak punya sesi user. Penolakan itu
  // perilaku yang benar — seed memang jalur provisioning.
  const { data: allProducts } = await db
    .from('products')
    .select('id, sku')
    .eq('organization_id', orgId)
  const { data: initialMoves } = await db
    .from('stock_movements')
    .select('product_id')
    .eq('organization_id', orgId)
    .eq('type', 'initial')
  const stocked = new Set((initialMoves ?? []).map((m) => m.product_id))

  let stockedNow = 0
  for (const p of allProducts) {
    if (stocked.has(p.id)) continue
    const qty = PRODUCTS.find(([sku]) => sku === p.sku)?.[5] ?? 0

    die(
      `stok awal ${p.sku}`,
      (
        await db
          .from('product_stocks')
          .upsert(
            { organization_id: orgId, product_id: p.id, outlet_id: outletId, quantity: qty },
            { onConflict: 'product_id,outlet_id' },
          )
      ).error,
    )
    die(
      `movement ${p.sku}`,
      (
        await db.from('stock_movements').insert({
          organization_id: orgId,
          outlet_id: outletId,
          product_id: p.id,
          type: 'initial',
          quantity_delta: qty,
          balance_after: qty,
          note: 'Stok awal (seed)',
        })
      ).error,
    )
    stockedNow++
  }
  log(`produk: ${allProducts.length} item, stok awal diisi untuk ${stockedNow}`)

  // ---------- 7. transaksi hari ini ----------
  const { count: trxCount } = await db
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  if (!trxCount) {
    const { data: prods } = await db
      .from('products')
      .select('id, sku, name, sell_price')
      .eq('organization_id', orgId)
    const bySku = Object.fromEntries(prods.map((p) => [p.sku, p]))
    const today = new Date().toISOString().slice(0, 10)
    let seq = 37

    for (const [time, who, method, lines] of TRANSACTIONS) {
      const items = lines.map(([sku, qty]) => ({
        product_id: bySku[sku].id,
        product_name: bySku[sku].name,
        sku,
        quantity: qty,
        unit_price: bySku[sku].sell_price,
      }))
      const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

      const { error } = await db.rpc('_apply_transaction', {
        p_org: orgId,
        p_origin: 'online',
        p_cashier: uid[who],
        p_trx: {
          code: `TRX-${today.replaceAll('-', '')}-K1-${String(seq++).padStart(4, '0')}`,
          outlet_id: outletId,
          device_id: device.id,
          client_created_at: `${today}T${time}:00+08:00`,
          payment_method: method,
          paid_amount: method === 'cash' ? Math.ceil(total / 5000) * 5000 : total,
          items,
        },
      })
      die(`transaksi ${time}`, error)
    }
    log(`transaksi: ${TRANSACTIONS.length} tercatat hari ini`)
  } else {
    log(`transaksi: ${trxCount} sudah ada, dilewati`)
  }

  // ---------- ringkasan ----------
  const { data: sales } = await db
    .from('v_daily_sales')
    .select('revenue, transaction_count, avg_ticket')
    .eq('organization_id', orgId)
  const { data: alerts } = await db.from('v_stock_alert').select('product_name, quantity, severity')

  console.log('\n✓ Seed selesai')
  console.log('  Omset hari ini   :', 'Rp ' + (sales?.[0]?.revenue ?? 0).toLocaleString('id-ID'))
  console.log('  Transaksi        :', sales?.[0]?.transaction_count ?? 0)
  console.log('  Rata-rata/trx    :', 'Rp ' + (sales?.[0]?.avg_ticket ?? 0).toLocaleString('id-ID'))
  console.log('  Stok perlu cek   :', (alerts ?? []).map((a) => `${a.product_name} (${a.quantity})`).join(', ') || '-')
  console.log('\n  Login: rina@tokodewi.id / nanda@tokodewi.id / admin@tokoku.id — password TokoKu123!')
}

main().catch((e) => {
  console.error('\n✗', e)
  process.exit(1)
})
