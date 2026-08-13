import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

/**
 * Menangkap error yang terjadi saat merender di server.
 *
 * Ini yang menutup celah sebenarnya: sebelum ada ini, satu-satunya jejak
 * kegagalan adalah kode `digest` di layar error yang harus DIBACAKAN KLIEN
 * lewat telepon. Sekarang errornya sampai lebih dulu, lengkap dengan rutenya.
 */
export const onRequestError = Sentry.captureRequestError
