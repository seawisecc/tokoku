import type { NextConfig } from 'next'

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

export default nextConfig
