/**
 * Layout auth: latar forest gelap agar panel gradient lime→mint menonjol.
 * Brand dan footer dirender di sini supaya semua halaman auth konsisten.
 */
import Link from 'next/link'
import { BrandLogo, BrandMark } from '@/components/layout/BrandMark'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div className="brand" style={{ color: '#fff' }}>
            <BrandLogo />
            <div className="brand-name">
              TokoKu
              <small style={{ color: 'rgba(255,255,255,.5)' }}>by Seawise Studio</small>
            </div>
          </div>
        </div>

        {children}

        {/* Satu-satunya jalan publik ke halaman fitur & harga. Orang yang
            mendarat di layar masuk tanpa akun tidak punya cara lain mengetahui
            apa yang sebenarnya dijual di sini. */}
        {/* Tautan legal dipasang di sini, bukan cuma di halaman publik: orang
            menilai apakah mau menyerahkan data pelanggannya TEPAT saat diminta
            mendaftar, dan dokumen yang tidak bisa ditemukan dari layar ini sama
            saja dengan tidak ada. */}
        <p className="auth-foot">
          <Link href="/fitur" className="auth-foot-link">
            Lihat fitur &amp; harga
          </Link>
          <br />
          <Link href="/kebijakan-privasi" className="auth-foot-link">
            Kebijakan Privasi
          </Link>
          {' · '}
          <Link href="/syarat-ketentuan" className="auth-foot-link">
            Syarat &amp; Ketentuan
          </Link>
          <br />
          TokoKu: POS &amp; ERP retail UMKM · <strong>by Seawise Studio</strong>
        </p>
      </div>
    </div>
  )
}
