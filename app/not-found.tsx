import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Halaman Tidak Ditemukan | TokoKu' }

/**
 * Halaman 404.
 *
 * Sebelum ini tidak ada sama sekali, jadi tautan lama atau URL yang salah ketik
 * mendarat di halaman bawaan Next.js: kotak putih berbahasa Inggris bertuliskan
 * "404 · This page could not be found", tanpa logo, tanpa warna, dan tanpa satu
 * pun jalan kembali. Untuk aplikasi yang dijual ke pemilik warung, layar itu
 * terbaca sebagai aplikasinya rusak, bukan alamatnya keliru.
 */
export default function NotFound() {
  return (
    <main className="pesan-layar">
      <div className="pesan-kartu">
        <p className="auth-eyebrow">Halaman tidak ada</p>
        <h1 className="auth-title">Alamatnya Tidak Ditemukan</h1>
        <p className="auth-sub">
          Halaman yang Anda buka sudah dipindah atau alamatnya salah ketik. Data toko Anda
          tidak terpengaruh sama sekali.
        </p>
        <Link href="/" className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  )
}
