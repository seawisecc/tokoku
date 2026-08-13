import Dexie, { type Table } from 'dexie'

/**
 * Penyimpanan lokal POS (IndexedDB lewat Dexie).
 *
 * Dua peran yang berbeda tajam:
 *  - `products` / `categories` / `stocks` / `members` — CACHE. Server yang
 *    berkuasa; isinya boleh ditimpa kapan saja tanpa kehilangan apa pun.
 *  - `outbox` — SUMBER KEBENARAN. Berisi penjualan yang sudah terjadi tapi
 *    belum sampai server. Baris di sini tidak boleh hilang sebelum
 *    dikonfirmasi server, bahkan kalau tab ditutup atau baterai habis.
 */

/**
 * Cache produk menyimpan HANYA kolom milik tabel products.
 *
 * Nama & warna kategori sengaja TIDAK disimpan di sini walau tampilan
 * membutuhkannya: `pull_catalog` mengirim baris tabel mentah, sehingga kolom
 * turunan apa pun akan tertimpa jadi undefined pada sync pertama. Penggabungan
 * dilakukan saat membaca, di `localCatalog()`.
 */
export type LocalProduct = {
  id: string
  /** Stempel tenant. Cache melekat pada BROWSER, bukan pada toko — lihat ensureTenant(). */
  organization_id: string
  sku: string
  barcode: string | null
  name: string
  category_id: string | null
  sell_price: number
  cost_price: number
  unit: string
  track_stock: boolean
  min_stock: number
  is_active: boolean
  /**
   * Promo ikut disimpan MENTAH (harga + rentang tanggal), bukan sebagai harga
   * jadi. Perangkat bisa berhari-hari tidak sinkron; menyimpan "harga yang
   * berlaku" berarti promo yang sudah lewat tetap dipakai, atau promo yang
   * baru mulai tidak pernah aktif. Yang menghitung berlaku/tidaknya adalah
   * `hargaBerlaku()` di catalog.ts, saat dibaca.
   */
  promo_price?: number | null
  promo_starts_at?: string | null
  promo_ends_at?: string | null
}

export type LocalCategory = {
  id: string
  organization_id: string
  name: string
  color_key: string
  sort_order: number
}

export type LocalStock = {
  key: string // `${product_id}|${outlet_id}`
  organization_id: string
  product_id: string
  outlet_id: string
  quantity: number
}

export type OutboxItem = {
  product_id: string
  product_name: string
  sku: string | null
  quantity: number
  unit_price: number
  discount: number
  /** Harga sebelum promo. Undefined = tidak sedang promo. Untuk struk saja. */
  normal_price?: number
}

export type OutboxTransaction = {
  id: string // UUID v7 dibuat di perangkat — kunci idempotensi sync
  code: string
  organization_id: string
  outlet_id: string
  device_id: string
  shift_id: string | null
  cashier_name: string
  /**
   * Pelanggan yang menempel di penjualan ini. Null = pembeli tidak terdaftar,
   * dan itu keadaan yang paling lazim di warung. Namanya ikut disimpan supaya
   * struk offline tetap bisa menyebutnya tanpa menunggu jaringan.
   */
  customer_id: string | null
  customer_name: string | null
  /**
   * Nomor pelanggan ikut disimpan, bukan diambil ulang dari server saat
   * dibutuhkan. Struk dikirim tepat setelah bayar — sering justru saat sinyal
   * sedang buruk — dan nomor yang harus dijemput dulu berarti kasir mengetik
   * ulang angka yang sebenarnya sudah ada di database.
   */
  customer_phone: string | null
  client_created_at: string
  payment_method: 'cash' | 'qris'
  paid_amount: number
  /**
   * Diskon nota yang diberikan kasir dengan tangan, beserta alasannya.
   * Server MENJEPITNYA ke `max_manual_discount_percent` — angka di sini
   * permintaan, bukan keputusan. Lihat migrasi 0042.
   */
  discount_manual?: number
  discount_reason?: string | null
  /** Potongan dari `customers.discount_percent`, dihitung ulang server. */
  discount_customer?: number
  /**
   * Poin yang ditukar pembeli di nota ini, dan nilai rupiahnya menurut struk
   * yang sudah dicetak.
   *
   * Keduanya dikirim, walau server menghitung ulang potongannya sendiri:
   * `points_value` dipakai server sebagai BATAS ATAS, supaya transaksi offline
   * yang baru tersinkron berhari-hari kemudian tidak diberi potongan lebih
   * besar daripada yang tercetak di kertas. Lihat migrasi 0039.
   *
   * Opsional demi baris lama yang sudah telanjur ada di antrean perangkat
   * sebelum fitur ini terpasang — di sana keduanya undefined dan dibaca 0.
   */
  points_redeemed?: number
  points_value?: number
  total: number
  origin: 'online' | 'offline'
  items: OutboxItem[]
  status: 'pending' | 'sending' | 'synced' | 'rejected'
  attempts: number
  last_error: string | null
  synced_at: string | null
}

export type LocalMeta = { key: string; value: unknown }

class TokoKuDB extends Dexie {
  products!: Table<LocalProduct, string>
  categories!: Table<LocalCategory, string>
  stocks!: Table<LocalStock, string>
  outbox!: Table<OutboxTransaction, string>
  meta!: Table<LocalMeta, string>

  constructor() {
    super('tokoku')
    this.version(1).stores({
      products: 'id, sku, barcode, category_id, name',
      stocks: 'key, product_id, outlet_id',
      outbox: 'id, status, client_created_at',
      meta: 'key',
    })
    this.version(2).stores({
      categories: 'id, sort_order',
    })
    // v3 menambahkan stempel tenant. Baris lama tidak punya kolom ini, jadi ia
    // otomatis tidak lolos saringan saat dibaca — persis yang diinginkan:
    // katalog sisa toko lain langsung tidak terlihat, tanpa perlu migrasi data.
    this.version(3).stores({
      products: 'id, organization_id, sku, barcode, category_id, name',
      categories: 'id, organization_id, sort_order',
      stocks: 'key, organization_id, product_id, outlet_id',
    })
  }
}

/**
 * Dexie hanya ada di browser. Modul ini bisa ikut ter-import saat render di
 * server, jadi instance-nya dibuat malas dan mengembalikan null di server.
 */
let _db: TokoKuDB | null = null

export function db(): TokoKuDB {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan lokal hanya tersedia di browser')
  }
  if (!_db) _db = new TokoKuDB()
  return _db
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db().meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value })
}

export const stockKey = (productId: string, outletId: string) => `${productId}|${outletId}`

/** Meta yang isinya hanya berlaku untuk satu toko. */
const TENANT_META = ['device', 'last_pull_at', 'last_sync_at']

/**
 * Kunci meta perangkat, DIPISAH PER OUTLET.
 *
 * Perangkat POS terdaftar per outlet (`devices.outlet_id`). Sempat disimpan di
 * satu kunci `device` dan dibuang tiap kali outlet berganti — akibatnya kembali
 * ke cabang yang sudah pernah dibuka MENDAFTARKAN PERANGKAT BARU, bukan memakai
 * yang lama. Kode perangkat naik terus (K1, K2, … K6 hanya dari beberapa kali
 * berpindah saat pengujian), dan tiap satu memakan jatah `max_devices` paket:
 * kasir yang berpindah cabang dua kali sehari menghabiskan kuota Growth dalam
 * sepekan.
 *
 * Disimpan per outlet, kembali ke cabang lama berarti memakai perangkat yang
 * sama seperti kemarin — dan nomor transaksinya tetap runut.
 */
export const deviceKey = (outletId: string) => `device:${outletId}`

/**
 * Meta yang isinya hanya berlaku untuk satu OUTLET dan HARUS dibuang saat
 * berpindah cabang.
 *
 * `last_pull_at` — `pull_catalog` mengirim stok HANYA untuk outlet yang diminta.
 * Kalau penandanya dibawa pindah, sinkronisasi pertama di cabang baru menjawab
 * "tidak ada perubahan sejak tadi" dan seluruh produk tampil stok 0 di kasir —
 * padahal barangnya penuh di rak.
 *
 * `device` TIDAK ada di sini: ia disimpan per outlet lewat `deviceKey()`, jadi
 * tidak perlu dibuang — justru harus dipertahankan supaya cabang lama memakai
 * perangkat yang sama.
 */
const OUTLET_META = ['last_pull_at']

/**
 * Pastikan cache lokal ini milik toko yang sedang dibuka.
 *
 * IndexedDB melekat pada BROWSER, bukan pada toko. Sebelum ada penjagaan ini,
 * satu browser yang pernah membuka dua toko menampilkan katalog keduanya
 * tercampur di POS — kategori dobel, produk toko lain ikut muncul di grid dan
 * bisa dimasukkan ke keranjang. Server tetap menolaknya, tapi bagi pemilik toko
 * itu terbaca sebagai kebocoran data, dan itu cukup untuk kehilangan
 * kepercayaan. Kena saat Super Admin memakai "Lihat sebagai Klien", saat satu
 * perangkat dipakai staf dua toko, dan saat seseorang pindah toko.
 *
 * `outbox` SENGAJA tidak ikut dibuang. Isinya penjualan yang sudah benar-benar
 * terjadi dan uangnya sudah diterima kasir; tiap barisnya membawa
 * `organization_id` sendiri dan akan terkirim ke toko yang benar (lihat
 * penyaringan di `flush`). Membuangnya sama dengan membuang uang orang.
 *
 * BERPINDAH OUTLET diperlakukan lebih ringan daripada berpindah toko, dan itu
 * disengaja. Produk & kategori milik organisasi, bukan outlet — membuangnya saat
 * pindah cabang berarti menarik ulang seluruh katalog di jaringan warung yang
 * sering buruk, tanpa ada yang diamankan. Yang memang harus dibuang cuma stok
 * (angkanya milik satu outlet) dan meta di `OUTLET_META`.
 *
 * @returns true kalau cache memang baru saja dikosongkan karena ganti toko.
 */
export async function ensureTenant(
  organizationId: string,
  outletId: string | null,
): Promise<boolean> {
  const d = db()
  const active = await getMeta<string>('active_org')

  if (active === organizationId) {
    const activeOutlet = await getMeta<string>('active_outlet')
    if (outletId && activeOutlet !== outletId) {
      await d.transaction('rw', d.stocks, d.meta, async () => {
        await d.stocks.clear()
        await d.meta.bulkDelete(OUTLET_META)
      })
      await setMeta('active_outlet', outletId)
    }
    return false
  }

  // Sengaja ikut membersihkan saat penandanya BELUM ADA. Cache yang dibuat
  // sebelum penanda ini diperkenalkan tidak bisa dibuktikan miliknya toko mana —
  // dan justru cache lama itulah yang membawa katalog toko lain. Menganggapnya
  // "pertama kali, biarkan saja" membuat perbaikan ini tidak berlaku persis di
  // perangkat yang bermasalah. Biayanya cuma satu kali seed ulang, dan
  // seedCatalog memang berjalan tepat setelah ini.
  await d.transaction('rw', d.products, d.categories, d.stocks, d.meta, async () => {
    await d.products.clear()
    await d.categories.clear()
    await d.stocks.clear()
    await d.meta.bulkDelete(TENANT_META)
    // Perangkat disimpan per outlet (`device:<id>`), jadi kunci tetapnya tidak
    // cukup — SEMUA perangkat toko sebelumnya harus ikut dibuang.
    const stale = await d.meta.toCollection().primaryKeys()
    await d.meta.bulkDelete(stale.filter((k) => String(k).startsWith('device:')))
  })

  await setMeta('active_org', organizationId)
  await setMeta('active_outlet', outletId)
  return true
}
