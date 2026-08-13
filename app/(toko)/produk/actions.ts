'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: string }

/**
 * Satu skema untuk semua jalur masuk.
 *
 * Harga dikirim sebagai string dari input dan dikonversi di sini, bukan di
 * komponen: konversi di client bisa dilewati siapa pun yang memanggil server
 * action langsung, sementara di sini selalu terlewati.
 */
const rupiahField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d]/g, ''))
  .refine((v) => v.length > 0, 'Wajib diisi')
  .transform(Number)
  .refine((n) => Number.isFinite(n) && n >= 0, 'Harga tidak boleh negatif')

const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama produk minimal 2 huruf').max(120),
    sku: z
      .string()
      .trim()
      .min(1, 'SKU wajib diisi')
      .max(40)
      .regex(/^[A-Za-z0-9._-]+$/, 'SKU hanya boleh huruf, angka, titik, strip'),
    barcode: z.string().trim().max(64).optional().or(z.literal('')),
    categoryId: z.string().uuid().optional().or(z.literal('')),
    unit: z.string().trim().min(1).max(16).default('pcs'),
    costPrice: rupiahField,
    sellPrice: rupiahField,
    minStock: z.coerce.number().int().min(0).default(10),
    trackStock: z.coerce.boolean().default(true),
    /**
     * Promo. Kosong = tidak ada promo, dan itu keadaan yang paling lazim —
     * jadi string kosong harus lolos jadi null, bukan ditolak sebagai "bukan
     * angka". Tanggalnya juga boleh kosong: promo tanpa batas waktu.
     */
    promoPrice: z
      .string()
      .trim()
      .transform((x) => x.replace(/[^\d]/g, ''))
      .transform((x) => (x === '' ? null : Number(x)))
      .refine((n) => n === null || (Number.isFinite(n) && n >= 0), 'Harga promo tidak benar'),
    promoStartsAt: z.string().trim().transform((x) => x || null),
    promoEndsAt: z.string().trim().transform((x) => x || null),
  })
  .refine((v) => v.promoPrice === null || v.promoPrice < v.sellPrice, {
    message: 'Harga promo harus lebih murah dari harga jual',
    path: ['promoPrice'],
  })
  .refine(
    (v) => !v.promoStartsAt || !v.promoEndsAt || v.promoStartsAt <= v.promoEndsAt,
    { message: 'Tanggal selesai promo lebih awal dari tanggal mulai', path: ['promoEndsAt'] },
  )
  .refine((v) => v.sellPrice >= v.costPrice, {
    message: 'Harga jual di bawah harga pokok, setiap penjualan akan rugi',
    path: ['sellPrice'],
  })

function parse(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    barcode: formData.get('barcode') ?? '',
    categoryId: formData.get('categoryId') ?? '',
    unit: formData.get('unit') || 'pcs',
    costPrice: formData.get('costPrice'),
    sellPrice: formData.get('sellPrice'),
    minStock: formData.get('minStock') || 10,
    trackStock: formData.get('trackStock') === 'on',
    promoPrice: formData.get('promoPrice') ?? '',
    promoStartsAt: formData.get('promoStartsAt') ?? '',
    promoEndsAt: formData.get('promoEndsAt') ?? '',
  })
}

function firstIssue(e: z.ZodError): { error: string; field?: string } {
  const issue = e.issues[0]
  return { error: issue.message, field: issue.path[0]?.toString() }
}

/** Ubah pesan error Postgres jadi kalimat yang berguna bagi pemilik toko. */
function friendly(message: string, code?: string): { error: string; field?: string } {
  if (code === '23505' || message.includes('duplicate key')) {
    if (message.includes('sku')) return { error: 'SKU ini sudah dipakai produk lain.', field: 'sku' }
    if (message.includes('barcode'))
      return { error: 'Barcode ini sudah dipakai produk lain.', field: 'barcode' }
    return { error: 'Data ini sudah ada.' }
  }
  if (code === '42501') return { error: 'Anda tidak punya izin mengubah produk.' }
  return { error: message }
}

export async function saveProduct(
  productId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  const supabase = await createClient()

  const parsed = parse(formData)
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) }
  const v = parsed.data

  const row = {
    organization_id: session.org!.id,
    name: v.name,
    sku: v.sku.toUpperCase(),
    barcode: v.barcode || null,
    category_id: v.categoryId || null,
    unit: v.unit,
    cost_price: v.costPrice,
    sell_price: v.sellPrice,
    min_stock: v.minStock,
    track_stock: v.trackStock,
    promo_price: v.promoPrice,
    // Tanggal ikut dikosongkan saat promonya dihapus — kalau tidak, promo
    // berikutnya akan mewarisi rentang tanggal promo yang lama tanpa terlihat.
    promo_starts_at: v.promoPrice === null ? null : v.promoStartsAt,
    promo_ends_at: v.promoPrice === null ? null : v.promoEndsAt,
  }

  const { error } = productId
    ? await supabase.from('products').update(row).eq('id', productId)
    : await supabase.from('products').insert({ ...row, created_by: session.userId })

  if (error) return { ok: false, ...friendly(error.message, error.code) }

  revalidatePath('/produk')
  revalidatePath('/kasir')
  return { ok: true }
}

/**
 * Hapus produk — soft delete.
 *
 * Baris tidak pernah benar-benar dibuang: `transaction_items` menunjuk ke sini,
 * dan perangkat offline perlu melihat `deleted_at` untuk membuang salinan
 * lokalnya. Hard delete tidak muncul di delta sync.
 */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  const { blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', productId)

  if (error) return { ok: false, ...friendly(error.message, error.code) }

  revalidatePath('/produk')
  revalidatePath('/kasir')
  return { ok: true }
}

/** Penyesuaian stok manual / hasil opname. */
export async function adjustStock(
  productId: string,
  newQty: number,
  note: string | null,
): Promise<ActionResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  const supabase = await createClient()
  if (!session.outletId) return { ok: false, error: 'Akun ini belum ditugaskan ke outlet.' }

  if (!Number.isInteger(newQty) || newQty < 0) {
    return { ok: false, error: 'Jumlah stok harus bilangan bulat, minimal 0.', field: 'qty' }
  }

  const { error } = await supabase.rpc('adjust_stock', {
    p_org: session.org!.id,
    p_product: productId,
    p_outlet: session.outletId,
    p_new_qty: newQty,
    p_type: 'opname',
    p_note: note ?? undefined,
  })

  if (error) return { ok: false, ...friendly(error.message, error.code) }

  revalidatePath('/produk')
  revalidatePath('/kasir')
  revalidatePath('/beranda')
  return { ok: true }
}

/**
 * Opname satu sesi: banyak produk sekaligus.
 *
 * Yang dikirim HANYA baris yang benar-benar diisi angkanya. Baris kosong
 * berarti "belum dihitung", bukan "stoknya nol" — dikirim sebagai 0, seluruh
 * rak yang belum sempat dihitung langsung dikosongkan dari pembukuan.
 *
 * Baris yang angkanya sama dengan stok tercatat juga tidak dikirim: tidak ada
 * yang berubah, dan mengirimnya cuma menambah baris "opname 0" di kartu stok
 * yang membuat riwayat sebenarnya jadi sulit dibaca.
 */
export async function bulkOpname(
  items: { productId: string; qty: number }[],
  note: string | null,
): Promise<ActionResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  if (!session.outletId) return { ok: false, error: 'Akun ini belum ditugaskan ke outlet.' }

  if (items.length === 0) {
    return { ok: false, error: 'Belum ada hasil hitung yang berbeda dari stok tercatat.' }
  }
  if (items.some((i) => !Number.isInteger(i.qty) || i.qty < 0)) {
    return { ok: false, error: 'Hasil hitung harus bilangan bulat, minimal 0.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bulk_adjust_stock', {
    p_org: session.org!.id,
    p_outlet: session.outletId,
    p_items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_note: note?.trim() || undefined,
  })

  if (error) return { ok: false, ...friendly(error.message, error.code) }

  revalidatePath('/produk')
  revalidatePath('/produk/opname')
  revalidatePath('/kasir')
  revalidatePath('/beranda')
  return { ok: true }
}
