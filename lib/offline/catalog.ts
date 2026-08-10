import {
  db,
  getMeta,
  setMeta,
  stockKey,
  type LocalCategory,
  type LocalProduct,
} from './db'
import { createClient } from '@/lib/supabase/client'

/** Bentuk yang dipakai layar POS: produk + kategori + stok, digabung saat baca. */
export type CatalogEntry = LocalProduct & {
  category_name: string | null
  color_key: string | null
  stock: number
}

export type CatalogSeed = {
  /* Stempel tenant tidak diminta dari pemanggil — diisi dari `organizationId`
     di bawah supaya tidak ada jalan menyetempelnya dengan toko yang salah. */
  products: (Omit<LocalProduct, 'organization_id'> & { stock: number })[]
  categories: Omit<LocalCategory, 'organization_id'>[]
  organizationId: string
  outletId: string
}

/**
 * Isi cache dari data yang sudah dirender server.
 *
 * Dipakai saat POS pertama dibuka: halaman sudah membawa katalog lengkap, jadi
 * kasir bisa langsung bekerja tanpa menunggu satu putaran jaringan lagi.
 */
export async function seedCatalog(seed: CatalogSeed): Promise<void> {
  const d = db()
  const org = seed.organizationId
  await d.transaction('rw', d.products, d.categories, d.stocks, async () => {
    await d.categories.bulkPut(seed.categories.map((c) => ({ ...c, organization_id: org })))
    await d.products.bulkPut(seed.products.map((p) => stripDerived(p, org)))
    await d.stocks.bulkPut(
      seed.products.map((p) => ({
        key: stockKey(p.id, seed.outletId),
        organization_id: org,
        product_id: p.id,
        outlet_id: seed.outletId,
        quantity: p.stock ?? 0,
      })),
    )
  })
}

/**
 * Buang kolom turunan supaya cache produk hanya berisi kolom tabel aslinya,
 * lalu stempel tenantnya. Stempelnya diambil dari argumen, BUKAN dari payload:
 * `pull_catalog` mengirim baris mentah yang bentuknya bisa berubah, dan
 * saringan antar toko tidak boleh bergantung pada itu.
 */
function stripDerived(
  p: Omit<LocalProduct, 'organization_id'> & Record<string, unknown>,
  organizationId: string,
): LocalProduct {
  return {
    organization_id: organizationId,
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    category_id: p.category_id,
    sell_price: p.sell_price,
    cost_price: p.cost_price,
    unit: p.unit,
    track_stock: p.track_stock,
    min_stock: p.min_stock,
    is_active: p.is_active,
  }
}

/**
 * Tarik perubahan katalog sejak sinkronisasi terakhir.
 *
 * Hanya baris yang berubah yang dikirim — di jaringan 3G yang buruk, menarik
 * 2000 produk setiap 5 menit bukan pilihan.
 */
export async function pullCatalog(organizationId: string, outletId: string): Promise<boolean> {
  const supabase = createClient()
  const since = (await getMeta<string>('last_pull_at')) ?? '1970-01-01T00:00:00Z'

  const { data, error } = await supabase.rpc('pull_catalog', {
    p_org: organizationId,
    p_outlet: outletId,
    p_since: since,
  })
  if (error || !data) return false

  const payload = data as {
    server_time: string
    categories: (LocalCategory & { deleted_at: string | null })[] | null
    products: (LocalProduct & { deleted_at: string | null })[] | null
    stocks: { product_id: string; outlet_id: string; quantity: number }[] | null
  }

  const d = db()
  await d.transaction('rw', d.products, d.categories, d.stocks, async () => {
    const cats = payload.categories ?? []
    const liveCats = cats.filter((c) => !c.deleted_at)
    const deadCats = cats.filter((c) => c.deleted_at).map((c) => c.id)
    if (liveCats.length)
      await d.categories.bulkPut(
        liveCats.map((c) => ({ ...c, organization_id: organizationId })),
      )
    if (deadCats.length) await d.categories.bulkDelete(deadCats)

    const prods = payload.products ?? []
    const live = prods.filter((p) => !p.deleted_at)
    const dead = prods.filter((p) => p.deleted_at).map((p) => p.id)
    if (live.length) await d.products.bulkPut(live.map((p) => stripDerived(p, organizationId)))
    if (dead.length) {
      await d.products.bulkDelete(dead)
      await d.stocks.bulkDelete(dead.map((id) => stockKey(id, outletId)))
    }

    for (const s of payload.stocks ?? []) {
      await d.stocks.put({
        key: stockKey(s.product_id, s.outlet_id),
        organization_id: organizationId,
        product_id: s.product_id,
        outlet_id: s.outlet_id,
        quantity: s.quantity,
      })
    }
  })

  await setMeta('last_pull_at', payload.server_time)
  return true
}

/** Gabungkan produk + kategori + stok untuk ditampilkan. */
/**
 * Selalu disaring per toko. Cache melekat pada browser, jadi tanpa saringan ini
 * satu perangkat yang pernah membuka dua toko menampilkan katalog keduanya
 * bercampur — dan kasir bisa memasukkan produk toko lain ke keranjang.
 */
export async function localCatalog(
  organizationId: string,
  outletId: string,
): Promise<CatalogEntry[]> {
  const d = db()
  const [products, categories, stocks] = await Promise.all([
    d.products.where('organization_id').equals(organizationId).toArray(),
    d.categories.where('organization_id').equals(organizationId).toArray(),
    d.stocks.where('organization_id').equals(organizationId).toArray(),
  ])

  const catById = new Map(categories.map((c) => [c.id, c]))
  const stockByKey = new Map(stocks.map((s) => [s.key, s.quantity]))

  return products
    .filter((p) => p.is_active)
    .map((p) => {
      const cat = p.category_id ? catById.get(p.category_id) : undefined
      return {
        ...p,
        category_name: cat?.name ?? null,
        color_key: cat?.color_key ?? null,
        stock: stockByKey.get(stockKey(p.id, outletId)) ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export async function localCategories(organizationId: string): Promise<LocalCategory[]> {
  const rows = await db().categories.where('organization_id').equals(organizationId).toArray()
  return rows.sort((a, b) => a.sort_order - b.sort_order)
}

