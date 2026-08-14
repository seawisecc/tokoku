/**
 * Sentry sisi browser.
 *
 * `replaysSessionSampleRate: 0` — perekaman sesi SENGAJA dimatikan. Layar kasir
 * menampilkan nama pelanggan, nomor HP, dan seluruh isi keranjang; merekamnya
 * berarti memindahkan data pribadi milik klien ke pihak ketiga, dan itu
 * bertentangan dengan Kebijakan Privasi yang kita tulis sendiri.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

/** Skema URL yang dipakai ekstensi peramban di Chrome, Firefox, dan Safari. */
const EKSTENSI = /^(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//

/**
 * Buang error yang JELAS berasal dari ekstensi peramban, bukan dari aplikasi.
 *
 * Sentry memasang penangkap global `onerror` dan `onunhandledrejection`, dan
 * keduanya ikut menangkap kegagalan skrip mana pun yang disuntikkan ekstensi ke
 * halaman kita. Kita tidak bisa memperbaikinya, tidak bisa mereproduksinya, dan
 * tidak tahu ekstensi siapa yang dipasang klien.
 *
 * Alasannya bukan kerapian: laporan yang tidak bisa ditindaklanjuti MELATIH
 * orang mengabaikan Sentry, dan begitu itu terjadi, laporan sungguhan ikut
 * tidak dibaca. Aturan yang sama dengan lencana notifikasi yang hanya
 * menghitung `danger` + `warn`.
 *
 * Yang dibuang hanya event yang SELURUH frame-nya milik ekstensi. Kalau ada
 * satu saja frame dari kode kita, event-nya tetap dikirim — ekstensi yang
 * memicu kegagalan di dalam kode kita tetap kegagalan kita.
 */
function dariEkstensi(event: Sentry.ErrorEvent): boolean {
  const frames = event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []) ?? []
  if (frames.length === 0) return false
  return frames.every((f) => EKSTENSI.test(f.filename ?? ''))
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    beforeSend: (event) => (dariEkstensi(event) ? null : event),
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
