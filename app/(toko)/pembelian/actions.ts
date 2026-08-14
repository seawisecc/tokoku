'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type PurchaseResult = { ok: true; code: string } | { ok: false; error: string }

/** Sama dengan enum `payment_method` di database. */
const METODE = ['cash', 'qris', 'transfer', 'card', 'other'] as const
type Metode = (typeof METODE)[number]
const metodeSah = (v: string): Metode =>
  (METODE as readonly string[]).includes(v) ? (v as Metode) : 'cash'

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
      // Cara bayar hanya berarti untuk nota yang langsung lunas. Untuk tempo,
      // yang menentukan arus kas adalah cara bayar saat DILUNASI nanti.
      payment_method: payment === 'paid' ? metodeSah(String(formData.get('paymentMethod') ?? 'cash')) : 'cash',
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

/**
 * Tandai pembelian tempo sudah dibayar.
 *
 * TANGGALNYA diisi yang membayar, tidak lagi diambil dari jam tombol ditekan.
 * `v_cash_flow` membaca `paid_at` untuk menempatkan uang keluarnya, jadi nota
 * yang dibayar Sabtu tapi baru ditandai Senin akan menggeser arus kas dua hari
 * — di laporan yang gunanya justru mencocokkan uang dengan tanggal.
 *
 * Cara bayarnya ikut dicatat karena transfer ke pemasok tidak mengurangi uang
 * di laci kasir, dan Arus Kas membedakan keduanya.
 */
export async function markPurchasePaid(
  purchaseId: string,
  paidOn: string,
  method: string,
  note: string,
): Promise<PurchaseResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return { ok: false, error: 'Tanggal pembayarannya belum diisi.' }
  }

  const supabase = await createClient()
  const { data: nota } = await supabase
    .from('purchases')
    .select('purchased_at, code')
    .eq('id', purchaseId)
    .eq('organization_id', session.org!.id)
    .maybeSingle()

  if (!nota) return { ok: false, error: 'Nota pembelian ini tidak ditemukan.' }

  // Hari ini menurut jam Indonesia Tengah, bukan jam server di Singapura.
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })
  if (paidOn > hariIni) {
    return { ok: false, error: 'Tanggal pembayaran tidak boleh di masa depan.' }
  }
  if (paidOn < nota.purchased_at) {
    return {
      ok: false,
      error: `Nota ${nota.code} bertanggal ${nota.purchased_at}, jadi pembayarannya tidak mungkin lebih awal dari itu.`,
    }
  }

  /**
   * Pukul 12.00 UTC, bukan tengah malam.
   *
   * Yang dipilih orang adalah TANGGAL, sementara kolomnya timestamptz dan
   * `v_cash_flow` mengubahnya kembali jadi tanggal memakai zona waktu toko.
   * Tengah malam UTC akan mundur sehari untuk zona waktu barat dan tengah
   * malam waktu lokal akan maju sehari untuk sebagian zona; tengah hari aman
   * ke dua arah.
   */
  const { data, error } = await supabase
    .from('purchases')
    .update({
      paid_at: `${paidOn}T12:00:00Z`,
      payment_method: metodeSah(method),
      paid_note: note.trim() || null,
    })
    .eq('id', purchaseId)
    .eq('organization_id', session.org!.id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  // UPDATE yang ditolak RLS menjawab "berhasil" dengan nol baris, bukan error.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Nota ini tidak bisa ditandai lunas dari akun Anda.' }
  }

  revalidatePath('/pembelian')
  revalidatePath('/laporan/keuangan')
  return { ok: true, code: 'ok' }
}
