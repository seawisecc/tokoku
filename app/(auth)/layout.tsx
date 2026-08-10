/**
 * Layout auth: latar forest gelap agar panel gradient lime→mint menonjol.
 * Brand dan footer dirender di sini supaya semua halaman auth konsisten.
 */
import { BrandMark } from '@/components/layout/BrandMark'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div className="brand" style={{ color: '#fff' }}>
            <div className="brand-mark">T</div>
            <div className="brand-name">
              TokoKu
              <small style={{ color: 'rgba(255,255,255,.5)' }}>by Seawise Studio</small>
            </div>
          </div>
        </div>

        {children}

        <p className="auth-foot">
          TokoKu — POS &amp; ERP retail UMKM · <strong>by Seawise Studio</strong>
        </p>
      </div>
    </div>
  )
}
