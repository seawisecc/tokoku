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
  })
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
