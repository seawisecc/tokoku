/**
 * Sentry sisi server.
 *
 * OPSIONAL SECARA SENGAJA, pola yang sama dengan `lib/email.ts`: tanpa
 * `NEXT_PUBLIC_SENTRY_DSN`, `init()` tidak pernah dipanggil dan Sentry jadi
 * tidak lebih dari kode mati. Aplikasi harus tetap utuh di mesin pengembang dan
 * di instalasi yang tidak memakai pemantauan pihak ketiga.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // 10% saja. Yang dicari di sini adalah ERROR, bukan profil performa —
    // dan kuota gratis Sentry habis cepat kalau semua jejak dikirim.
    tracesSampleRate: 0.1,
    // Jangan pernah mengirim isi request. Body request di aplikasi ini memuat
    // nama pelanggan, nomor HP, dan rincian penjualan milik klien.
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? 'development',
  })
}
