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

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
