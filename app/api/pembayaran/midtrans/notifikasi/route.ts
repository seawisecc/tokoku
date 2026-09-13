import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  midtransConfigured,
  verifyNotificationSignature,
  type MidtransNotification,
} from '@/lib/midtrans'

/**
 * Pemberitahuan pembayaran dari Midtrans, server ke server.
 *
 * INI SUMBER KEBENARAN STATUS PEMBAYARAN, bukan halaman yang dibuka pengguna
 * setelah membayar. Pengguna bisa menutup peramban tepat setelah menekan bayar,
 * dan virtual account sering baru dibayar besok pagi saat tidak ada satu pun
 * halaman kita yang terbuka. Aktivasi langganan karena itu hanya dipicu dari
 * sini.
 *
 * ---------------------------------------------------------------------------
 * KENAPA ROUTE HANDLER, DAN KENAPA SERVICE ROLE
 *
 * Route handler karena yang datang bukan pengguna: tidak ada cookie, tidak ada
 * sesi, dan tidak ada halaman yang dirender. Service role karena
 * `apply_subscription_payment` menulis `status`, `plan_id`, dan
 * `subscription_ends_at` di `organizations` — ketiganya dikunci trigger
 * `tg_guard_org_commercial` untuk siapa pun yang punya sesi (lihat migrasi 0036
 * & 0041). Yang meloloskannya adalah cabang `auth.uid() is null`, dan itu hanya
 * berlaku untuk pemanggil tanpa sesi user.
 *
 * Jadi `SUPABASE_SERVICE_ROLE_KEY` kembali WAJIB ada di env produksi. Sebelum
 * ini ia tidak dipakai kode mana pun dan sempat dicatat boleh dihapus.
 *
 * ---------------------------------------------------------------------------
 * KENAPA HAMPIR SEMUANYA DIJAWAB 200
 *
 * Midtrans mengulang pemberitahuan sampai menerima 2xx. Itu perilaku yang benar
 * untuk kegagalan sementara, tapi salah untuk kegagalan permanen: nomor pesanan
 * yang tidak dikenal atau nominal yang tidak cocok tidak akan pernah membaik
 * dengan diulang, dan pengulangannya cuma membanjiri log sampai ada yang
 * mematikan pemberitahuannya sama sekali. Keadaan seperti itu dijawab 200 dan
 * dikirim ke Sentry supaya kita yang mengejarnya, bukan Midtrans.
 *
 * Yang dijawab BUKAN 2xx hanya dua: tanda tangan tidak sah (401, karena memang
 * bukan dari Midtrans) dan kegagalan database (500, karena pengulangannya
 * memang menolong).
 */

export const dynamic = 'force-dynamic'
// Jalur uang tidak boleh ikut jatuh ke node lain benua. Alasannya sama dengan
// `regions: ["sin1"]` di vercel.json: databasenya ada di Singapura.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!midtransConfigured()) {
    // Tidak mungkin terjadi di produksi, tapi kalau env-nya hilang saat deploy,
    // kegagalan ini harus terbaca sebagai kegagalan konfigurasi, bukan sebagai
    // pembayaran yang ditolak.
    Sentry.captureMessage('Pemberitahuan Midtrans masuk tapi MIDTRANS_SERVER_KEY kosong', 'error')
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
  }

  let payload: MidtransNotification
  try {
    payload = (await request.json()) as MidtransNotification
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 })
  }

  const orderId = String(payload.order_id ?? '')
  if (!orderId) {
    return NextResponse.json({ ok: false, reason: 'no_order_id' }, { status: 400 })
  }

  /**
   * Tanda tangan diperiksa SEBELUM apa pun disentuh.
   *
   * Alamat ini terbuka untuk umum dan harus begitu, karena Midtrans yang
   * memanggilnya. Tanpa pemeriksaan ini, satu permintaan POST yang diketik
   * tangan dengan nomor pesanan yang benar sudah cukup untuk mengaktifkan
   * langganan tanpa membayar sepeser pun.
   */
  if (!verifyNotificationSignature(payload)) {
    Sentry.captureMessage(`Tanda tangan pemberitahuan Midtrans tidak cocok: ${orderId}`, 'warning')
    return NextResponse.json({ ok: false, reason: 'bad_signature' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('apply_subscription_payment', {
      p_order_id: orderId,
      p_payload: payload as never,
    })

    if (error) {
      // Kegagalan database memang layak diulang Midtrans.
      Sentry.captureException(error, { extra: { orderId, where: 'apply_subscription_payment' } })
      return NextResponse.json({ ok: false, reason: 'db_error' }, { status: 500 })
    }

    const hasil = (data ?? {}) as { ok?: boolean; reason?: string }

    /**
     * Ditolak fungsi, bukan gagal.
     *
     * Nomor pesanan yang tidak dikenal dan nominal yang tidak cocok keduanya
     * berarti ada yang salah di sisi kita, dan tidak satu pun akan membaik
     * dengan diulang. Dijawab 200 supaya Midtrans berhenti, lalu dikirim ke
     * Sentry supaya tidak hilang. Kegagalan senyap di jalur uang adalah hal
     * yang paling dihindari di project ini.
     */
    if (hasil.ok === false) {
      Sentry.captureMessage(
        `Pemberitahuan Midtrans ditolak (${hasil.reason ?? 'tanpa alasan'}): ${orderId}`,
        'error',
      )
    }

    return NextResponse.json({ ok: true, order_id: orderId }, { status: 200 })
  } catch (e) {
    Sentry.captureException(e, { extra: { orderId, where: 'notifikasi-midtrans' } })
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}

/**
 * GET dibiarkan menjawab, sengaja.
 *
 * Alamat pemberitahuan sering dibuka di peramban saat mendaftarkannya di panel
 * Midtrans, sekadar memastikan alamatnya benar. Tanpa penangan GET, yang muncul
 * adalah 405 telanjang yang terbaca seperti alamatnya salah ketik.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'TokoKu · pemberitahuan pembayaran Midtrans',
    note: 'Alamat ini hanya menerima POST dari Midtrans.',
  })
}
