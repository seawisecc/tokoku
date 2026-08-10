import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/layout/BrandMark'

export const metadata: Metadata = {
  title: 'Tentang — TokoKu',
  description: 'TokoKu — POS & ERP retail untuk UMKM. Dibuat oleh Seawise Studio.',
}

export default function AboutPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 20px 64px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <BrandMark context="by Seawise Studio" />

        <h1 style={{ fontSize: 'clamp(24px,5vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '28px 0 10px' }}>
          Kasir yang tetap jalan waktu internet mati.
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--color-ink-soft)', lineHeight: 1.7, margin: 0 }}>
          TokoKu adalah aplikasi kasir dan ERP untuk usaha retail kecil — warung, kios, toko
          kelontong, minimarket. Dibuat karena satu kenyataan sederhana: di banyak daerah,
          internet putus beberapa kali sehari, dan kasir tidak boleh ikut berhenti.
        </p>

        <div className="section-title">Yang membedakan</div>
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Penjualan tidak pernah hilang</b>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              Setiap transaksi disimpan di perangkat lebih dulu, struk tercetak seketika, lalu
              dikirim ke server di latar belakang. Alurnya sama persis baik ada internet maupun tidak.
            </p>
          </div>
          <div>
            <b style={{ fontSize: 13.5 }}>Nomor struk yang tidak berubah</b>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              Setiap mesin kasir menomori transaksinya sendiri. Nomor di struk yang sudah dicetak
              akan selalu sama dengan yang tercatat di pembukuan.
            </p>
          </div>
          <div>
            <b style={{ fontSize: 13.5 }}>Data tiap toko terkunci sendiri-sendiri</b>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              Pemisahan antar toko ditegakkan di lapisan database, bukan hanya di tampilan.
            </p>
          </div>
        </div>

        <div className="section-title">Seawise Studio</div>
        <div className="card">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-soft)', lineHeight: 1.7 }}>
            TokoKu dirancang dan dikembangkan oleh <strong style={{ color: 'var(--color-ink)' }}>Seawise Studio</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <Link href="/masuk" className="btn btn-primary">
            Masuk ke Aplikasi
          </Link>
        </div>

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid var(--color-line)', fontSize: 12, color: 'var(--color-ink-faint)' }}>
          TokoKu — POS &amp; ERP retail UMKM · <strong>by Seawise Studio</strong>
        </footer>
      </div>
    </main>
  )
}
