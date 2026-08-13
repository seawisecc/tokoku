import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandMark'

/**
 * Kerangka halaman publik bertulisan panjang: Kebijakan Privasi dan Syarat &
 * Ketentuan.
 *
 * Sengaja TIDAK memakai AppShell. Keduanya harus bisa dibaca tanpa akun sama
 * sekali — calon klien menilainya sebelum mendaftar, dan pelanggan warung yang
 * mempersoalkan datanya belum tentu punya akun di sini.
 *
 * Latarnya terang, bukan forest gelap seperti halaman auth: ini dokumen yang
 * dibaca lama, bukan layar satu langkah.
 */
export default function PublikLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <header className="legal-top">
        <Link href="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <BrandLogo />
          <div className="brand-name">
            TokoKu
            <small>by Seawise Studio</small>
          </div>
        </Link>
      </header>

      <main className="legal-body">{children}</main>

      <footer className="legal-foot">
        <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>
        <span aria-hidden>·</span>
        <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>
        <span aria-hidden>·</span>
        <Link href="/fitur">Fitur &amp; Harga</Link>
        <p>TokoKu: POS &amp; ERP retail UMKM · by Seawise Studio</p>
      </footer>
    </div>
  )
}
