import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

/**
 * Header keamanan dasar.
 *
 * Sengaja hanya tiga, dan ketiganya tidak mungkin merusak apa pun yang sudah
 * berjalan. Yang TIDAK dipasang di sini juga disengaja:
 *
 * - **Content-Security-Policy** butuh nonce untuk script inline milik Next dan
 *   harus diuji di seluruh halaman; dipasang asal-asalan, layar kasir berhenti
 *   bekerja tanpa pesan apa pun.
 * - **Permissions-Policy** menyentuh `camera`, dan kamera adalah jalur pemindai
 *   barcode yang baru dibuktikan bekerja di HP sungguhan. Satu salah tulis di
 *   sana mematikannya kembali tanpa error yang kelihatan.
 *
 * `X-Frame-Options` sengaja SAMEORIGIN, bukan DENY: pengujian tampilan 390px di
 * project ini dikerjakan dengan memuat aplikasi di dalam iframe same-origin
 * (lihat "Mobile" di CLAUDE.md). DENY akan mematikan satu-satunya cara menguji
 * mobile yang terbukti bekerja di sini.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

/**
 * Sentry dibungkuskan HANYA kalau DSN-nya ada.
 *
 * Tanpa penjagaan ini, `withSentryConfig` tetap ikut di setiap build — termasuk
 * di mesin pengembang dan di instalasi yang tidak memakai pemantauan sama
 * sekali — lalu mencoba mengunggah source map tanpa kredensial dan membuat
 * build gagal karena sesuatu yang tidak ada hubungannya dengan aplikasinya.
 * Polanya sama dengan email di `lib/email.ts`: opsional secara sengaja, dan
 * ketiadaannya bukan kegagalan.
 *
 * Unggah source map hanya menyala kalau `SENTRY_AUTH_TOKEN` ikut ada. Tanpa
 * itu errornya tetap terkirim, cuma nomor barisnya menunjuk kode terkompilasi.
 */
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      silent: true,
      // Rute penerus supaya laporan error tidak diblokir pemblokir iklan —
      // tanpa ini sebagian besar error dari browser pengguna tidak pernah
      // sampai, dan yang tersisa justru bukan gambaran sebenarnya.
      tunnelRoute: '/monitoring',
      disableLogger: true,
    })
  : nextConfig
