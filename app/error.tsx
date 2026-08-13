'use client'

/**
 * Penangkap error untuk seluruh aplikasi.
 *
 * Tanpa berkas ini, satu kegagalan render membuat Next.js menampilkan layar
 * bawaannya: di produksi cuma "Application error: a client-side exception has
 * occurred", berbahasa Inggris, tanpa tombol apa pun. Kasir yang menemuinya di
 * tengah antrean tidak punya jalan selain menutup browsernya.
 *
 * Dua tombol, dan keduanya perlu: **Coba lagi** memanggil `reset()` yang
 * me-render ulang segmennya tanpa memuat ulang halaman — cukup untuk kegagalan
 * sesaat seperti jaringan putus di tengah permintaan. **Muat ulang** untuk
 * sisanya. Yang TIDAK ditampilkan adalah isi errornya: bagi pemilik warung itu
 * bukan informasi, dan pesan error React sering memuat potongan data.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="pesan-layar">
      <div className="pesan-kartu">
        <p className="auth-eyebrow">Ada yang tidak beres</p>
        <h1 className="auth-title">Halaman Ini Gagal Dimuat</h1>
        <p className="auth-sub">
          Penjualan yang sudah tercatat tetap aman, termasuk yang masih menunggu terkirim di
          perangkat kasir. Coba lagi sebentar; kalau masih sama, hubungi kami dan sebutkan
          kode di bawah.
        </p>

        <button type="button" className="btn btn-primary btn-block" onClick={reset}>
          Coba Lagi
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          onClick={() => window.location.reload()}
        >
          Muat Ulang Halaman
        </button>

        {/* `digest` adalah satu-satunya penghubung ke log server. Tanpa itu,
            laporan "aplikasinya error" tidak bisa dicocokkan dengan apa pun. */}
        {error.digest && (
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 14 }}>
            Kode kejadian: <span className="mono">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  )
}
