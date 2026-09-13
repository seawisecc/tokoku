'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireWrite } from '@/lib/auth'
import { midtransConfigured, snapCreateTransaction, snapExpiresAt } from '@/lib/midtrans'
import { createClient } from '@/lib/supabase/server'

export type CheckoutResult =
  | { ok: true; redirectUrl: string; orderId: string }
  | { ok: false; error: string }

const skema = z.object({
  planId: z.string().uuid('Paket yang dipilih tidak dikenali.'),
  months: z.coerce
    .number()
    .int()
    .min(1, 'Pilih minimal 1 bulan.')
    .max(24, 'Maksimal 24 bulan sekaligus.'),
})

/**
 * Buat tagihan lalu buka halaman pembayaran Midtrans.
 *
 * Dua langkah yang sengaja TIDAK digabung, dan urutannya penting:
 *
 *   1. `create_subscription_invoice` menyimpan tagihan berstatus menunggu.
 *      Nominalnya dihitung DATABASE dari `plans.price_monthly`; yang dikirim
 *      dari layar cuma "paket mana" dan "berapa bulan". Angka rupiah yang
 *      datang dari peramban tidak pernah dipercaya di mana pun di jalur ini —
 *      aturan yang sama dengan `discount_total` di migrasi 0039.
 *
 *   2. Baru setelah tagihannya ada, tokennya diminta ke Midtrans.
 *
 * Kalau digabung dalam satu langkah, kegagalan meminta token (jaringan warung
 * yang putus, Midtrans sedang lambat) akan ikut membatalkan tagihannya, dan
 * percobaan berikutnya melahirkan nomor pesanan baru lagi. Dipisah begini,
 * tagihan yang sama dipakai ulang sampai ia benar-benar kedaluwarsa.
 */
export async function startSubscriptionPayment(formData: FormData): Promise<CheckoutResult> {
  const { session, blocked } = await requireWrite('settings')
  if (blocked) return { ok: false, error: blocked }

  if (!midtransConfigured()) {
    return {
      ok: false,
      error: 'Pembayaran online belum diaktifkan di aplikasi ini. Hubungi admin TokoKu lewat WhatsApp.',
    }
  }

  const parsed = skema.safeParse({
    planId: formData.get('planId'),
    months: formData.get('months'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const orgId = session.org?.id
  if (!orgId) return { ok: false, error: 'Toko aktif tidak terbaca. Muat ulang halaman.' }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_subscription_invoice', {
    p_org: orgId,
    p_plan: parsed.data.planId,
    p_months: parsed.data.months,
  })

  if (error) return { ok: false, error: error.message }

  const tagihan = (data ?? {}) as {
    order_id?: string
    amount?: number
    months?: number
    plan_name?: string
    snap_redirect_url?: string | null
  }

  if (!tagihan.order_id) {
    return { ok: false, error: 'Tagihan gagal dibuat. Coba lagi sebentar lagi.' }
  }

  /**
   * Tagihan lama yang tokennya masih hidup dipakai ulang apa adanya.
   *
   * Ini yang membuat "tutup halaman pembayaran lalu buka lagi" tidak melahirkan
   * nomor virtual account baru setiap kali. Pembeli yang sudah menyalin nomor
   * VA ke aplikasi banknya tidak boleh menemukan nomor itu berubah saat ia
   * kembali ke layar.
   */
  if (tagihan.snap_redirect_url) {
    return { ok: true, redirectUrl: tagihan.snap_redirect_url, orderId: tagihan.order_id }
  }

  const snap = await snapCreateTransaction({
    orderId: tagihan.order_id,
    amount: Number(tagihan.amount ?? 0),
    months: Number(tagihan.months ?? parsed.data.months),
    planName: String(tagihan.plan_name ?? 'TokoKu'),
    storeName: session.org!.name,
    customerName: session.fullName || session.org!.name,
    customerEmail: session.email,
  })

  if (!snap.ok) {
    Sentry.captureMessage(`Snap gagal dibuat untuk ${tagihan.order_id}: ${snap.error}`, 'error')
    return { ok: false, error: snap.error }
  }

  // Kegagalan menyimpan token BUKAN alasan membatalkan pembayaran: tokennya
  // sudah sah di sisi Midtrans dan pengguna berhak diantar ke sana. Yang hilang
  // cuma kemampuan memakai ulang tautan yang sama nanti.
  const { error: simpanError } = await supabase.rpc('attach_invoice_snap', {
    p_order_id: tagihan.order_id,
    p_token: snap.token,
    p_url: snap.redirectUrl,
    p_expires: snapExpiresAt().toISOString(),
  })
  if (simpanError) {
    Sentry.captureException(simpanError, {
      extra: { orderId: tagihan.order_id, where: 'attach_invoice_snap' },
    })
  }

  revalidatePath('/pengaturan/langganan')
  return { ok: true, redirectUrl: snap.redirectUrl, orderId: tagihan.order_id }
}
