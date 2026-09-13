import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { fetchTransactionStatus, midtransConfigured } from '@/lib/midtrans'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Jaring pengaman untuk pemberitahuan yang tidak pernah sampai.
 *
 * Sumber kebenaran status pembayaran tetap pemberitahuan server ke server dari
 * Midtrans. Tapi pemberitahuan bisa hilang: deploy yang kebetulan berjalan saat
 * ia dikirim, gangguan jaringan, alamat yang salah ketik di dashboard. Tanpa
 * jaring ini, satu webhook yang hilang berarti satu klien yang SUDAH MEMBAYAR
 * tetap terkunci sampai ada yang menelepon — dan pemilik warung yang sudah
 * membayar lalu tidak bisa berjualan tidak akan menelepon dengan sabar.
 *
 * Dipanggil dari halaman Langganan, hanya kalau ada tagihan yang masih
 * menunggu. Toko yang tidak punya tagihan menunggu tidak membayar apa pun untuk
 * jaring ini.
 *
 * ---------------------------------------------------------------------------
 * KENAPA BOLEH MEMAKAI SERVICE ROLE DI SINI
 *
 * Aturan project ini tegas: `createAdminClient()` tidak pernah dipakai untuk
 * melayani request user biasa, karena di situ RLS satu-satunya yang mencegah
 * data satu toko bocor ke toko lain. Yang di bawah ini pengecualian yang
 * dipersempit sampai tidak lagi bisa dipakai membaca apa pun:
 *
 *   - nomor pesanannya dibaca lebih dulu oleh pemanggil lewat klien ber-RLS,
 *     jadi kepemilikannya sudah terbukti sebelum fungsi ini dipanggil
 *   - status pembayarannya ditanyakan ke MIDTRANS, bukan ke database kita
 *   - yang dilakukan service role cuma satu panggilan RPC yang hak panggilnya
 *     memang dicabut dari `authenticated`, dengan nomor pesanan sebagai
 *     satu-satunya masukan
 *
 * Tidak ada satu baris pun yang dibaca dengan kunci itu. Alasan yang sama
 * dengan route handler pemberitahuan.
 */
export async function syncPendingInvoice(orderId: string): Promise<'changed' | 'unchanged'> {
  if (!midtransConfigured()) return 'unchanged'

  const status = await fetchTransactionStatus(orderId)
  if (!status?.transaction_status) return 'unchanged'

  // Masih menunggu di Midtrans juga berarti tidak ada yang perlu diselaraskan.
  // Virtual account yang belum dibayar akan menjawab 'pending' berhari-hari.
  if (status.transaction_status === 'pending') return 'unchanged'

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('apply_subscription_payment', {
      p_order_id: orderId,
      p_payload: status as never,
    })
    if (error) {
      Sentry.captureException(error, { extra: { orderId, where: 'syncPendingInvoice' } })
      return 'unchanged'
    }
    const hasil = (data ?? {}) as { ok?: boolean; reason?: string }
    if (hasil.reason === 'already_applied') return 'unchanged'
    return hasil.ok ? 'changed' : 'unchanged'
  } catch (e) {
    /**
     * Kegagalan menyelaraskan TIDAK BOLEH menjatuhkan halaman Langganan.
     *
     * Yang paling mungkin membuat blok ini melempar adalah
     * `SUPABASE_SERVICE_ROLE_KEY` yang tidak ada di env. Kalau itu sampai
     * terjadi, yang benar adalah halamannya tetap terbuka dengan status
     * tersimpan apa adanya, bukan layar error untuk pemilik toko yang cuma
     * ingin melihat sisa masa langganannya.
     */
    Sentry.captureException(e, { extra: { orderId, where: 'syncPendingInvoice' } })
    return 'unchanged'
  }
}
