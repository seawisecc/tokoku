'use server'

import { revalidatePath } from 'next/cache'
import { requireWrite } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type VoidResult = { ok: true } | { ok: false; error: string }

/**
 * Batalkan transaksi.
 *
 * Barisnya tidak dihapus — statusnya jadi `void`, stok dikembalikan, dan
 * `stock_movements` mencatat pengembaliannya. Penjualan yang pernah terjadi
 * harus tetap terlihat di pembukuan walau dibatalkan; menghapusnya berarti
 * angka kemarin bisa berubah diam-diam.
 *
 * Butuh izin `reports` (pemilik/admin). RPC-nya mengecek ulang di sisi server,
 * jadi kasir tidak bisa membatalkan transaksinya sendiri.
 */
export async function voidTransaction(trxId: string, reason: string): Promise<VoidResult> {
  const { blocked } = await requireWrite('reports')
  if (blocked) return { ok: false, error: blocked }

  const alasan = reason.trim()
  if (alasan.length < 4) {
    return { ok: false, error: 'Tulis alasan pembatalan minimal 4 huruf. Ini tercatat permanen.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('void_transaction', {
    p_trx_id: trxId,
    p_reason: alasan,
  })

  if (error) {
    if (error.code === '42501') return { ok: false, error: 'Anda tidak punya izin membatalkan transaksi.' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/transaksi')
  revalidatePath(`/transaksi/${trxId}`)
  revalidatePath('/beranda')
  revalidatePath('/produk')
  return { ok: true }
}
