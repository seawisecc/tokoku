'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type PurchaseResult = { ok: true; code: string } | { ok: false; error: string }

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive('Jumlah harus lebih dari nol.'),
  unitCost: z.coerce.number().int().min(0),
})

/**
 * Simpan pembelian.
 *
 * Seluruh kerjanya ada di RPC `create_purchase` — nota, kenaikan stok, dan
 * pembaruan HPP harus terjadi bersama atau tidak sama sekali. Merangkainya di
 * sini berarti kegagalan di tengah menyisakan stok naik tanpa notanya.
 */
export async function savePurchase(formData: FormData): Promise<PurchaseResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  let items: unknown
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { ok: false, error: 'Daftar barang tidak terbaca. Coba ulangi.' }
  }

  const parsed = z.array(itemSchema).min(1, 'Tambahkan minimal satu barang.').safeParse(items)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const payment = String(formData.get('payment') ?? 'paid')
  const dueDate = String(formData.get('dueDate') ?? '').trim()
  if (payment === 'credit' && !dueDate) {
    return { ok: false, error: 'Pembelian tempo harus punya tanggal jatuh tempo.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_purchase', {
    p_org: session.org!.id,
    p_payload: {
      outlet_id: session.outletId,
      supplier_id: String(formData.get('supplierId') ?? ''),
      invoice_no: String(formData.get('invoiceNo') ?? ''),
      purchased_at: String(formData.get('purchasedAt') ?? ''),
      payment,
      due_date: dueDate,
      note: String(formData.get('note') ?? ''),
      items: parsed.data.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        unit_cost: i.unitCost,
      })),
    },
  })

  // Pesan dari database sudah ditulis untuk pemilik warung (TK002 langganan,
  // TK003 isi pembelian), jadi diteruskan apa adanya.
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pembelian')
  revalidatePath('/produk')
  revalidatePath('/kasir')
  return { ok: true, code: (data as { code: string }).code }
}

export async function createSupplier(name: string, phone: string): Promise<PurchaseResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }
  if (name.trim().length < 2) return { ok: false, error: 'Nama pemasok minimal 2 huruf.' }

  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').insert({
    organization_id: session.org!.id,
    name: name.trim(),
    phone: phone.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pembelian')
  return { ok: true, code: name.trim() }
}

/** Tandai pembelian tempo sudah dibayar. */
export async function markPurchasePaid(purchaseId: string): Promise<PurchaseResult> {
  const { blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { error } = await supabase
    .from('purchases')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', purchaseId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/pembelian')
  return { ok: true, code: 'ok' }
}
