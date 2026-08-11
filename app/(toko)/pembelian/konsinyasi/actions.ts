'use server'

import { revalidatePath } from 'next/cache'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ConsignResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Semua aksi di sini menembak RPC, bukan tabel.
 *
 * Tiap satu tindakan menyentuh beberapa tabel sekaligus — titipan, buku besar
 * titipan, stok, dan kartu stok — dan harus terjadi bersama atau tidak sama
 * sekali. Dirangkai dari sini, kegagalan di tengah menyisakan stok yang naik
 * tanpa ada catatan siapa yang menitipkannya.
 *
 * Pesan error dari database sudah ditulis untuk pemilik warung (TK003 isi
 * borang, TK002 langganan), jadi diteruskan apa adanya.
 */
function revalidate() {
  revalidatePath('/pembelian/konsinyasi')
  revalidatePath('/produk')
  revalidatePath('/kasir')
}

export async function recordIntake(input: {
  supplierId: string
  productId: string
  quantity: number
  consignPrice: number
  occurredOn: string
  note: string
}): Promise<ConsignResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  if (!input.supplierId) return { ok: false, error: 'Pilih pemasok yang menitipkan barangnya.' }
  if (!input.productId) return { ok: false, error: 'Pilih produk yang dititipkan.' }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'Jumlah barang titipan harus lebih dari nol.' }
  }
  if (!Number.isInteger(input.consignPrice) || input.consignPrice < 0) {
    return {
      ok: false,
      error: 'Isi harga titip, yaitu bagian pemasok untuk setiap satuan yang terjual.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_consignment_intake', {
    p_org: session.org!.id,
    p_payload: {
      supplier_id: input.supplierId,
      product_id: input.productId,
      outlet_id: session.outletId,
      quantity: input.quantity,
      consign_price: input.consignPrice,
      occurred_on: input.occurredOn,
      note: input.note,
    },
  })
  if (error) return { ok: false, error: error.message }

  revalidate()
  return { ok: true, message: 'Barang titipan tercatat dan stok sudah bertambah.' }
}

export async function recordReturn(input: {
  consignmentId: string
  quantity: number
  occurredOn: string
  note: string
}): Promise<ConsignResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'Jumlah retur harus lebih dari nol.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_consignment_return', {
    p_org: session.org!.id,
    p_payload: {
      consignment_id: input.consignmentId,
      quantity: input.quantity,
      occurred_on: input.occurredOn,
      note: input.note,
    },
  })
  if (error) return { ok: false, error: error.message }

  revalidate()
  return { ok: true, message: 'Retur tercatat dan stok sudah dikurangi.' }
}

export async function settleSupplier(input: {
  supplierId: string
  settledOn: string
  note: string
}): Promise<ConsignResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('settle_consignment', {
    p_org: session.org!.id,
    p_payload: {
      supplier_id: input.supplierId,
      settled_on: input.settledOn,
      note: input.note,
    },
  })
  if (error) return { ok: false, error: error.message }

  const res = data as { code: string; quantity: number; total: number }
  revalidate()
  return {
    ok: true,
    message: `Setoran ${res.code} tercatat: ${res.quantity} satuan, Rp ${res.total.toLocaleString('id-ID')}.`,
  }
}

export async function endConsignment(consignmentId: string): Promise<ConsignResult> {
  const { session, blocked } = await requireWrite('products')
  if (blocked) return { ok: false, error: blocked }

  const supabase = await createClient()
  const { error } = await supabase.rpc('end_consignment', {
    p_org: session.org!.id,
    p_consignment: consignmentId,
  })
  if (error) return { ok: false, error: error.message }

  revalidate()
  return { ok: true, message: 'Titipan ditutup.' }
}
