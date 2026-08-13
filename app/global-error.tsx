'use client'

/**
 * Penangkap error terakhir: dipakai kalau yang gagal justru ROOT LAYOUT-nya.
 *
 * Berbeda dari `error.tsx`, berkas ini MENGGANTI seluruh dokumen — jadi ia
 * harus membawa `<html>` dan `<body>` sendiri, dan tidak boleh bergantung pada
 * apa pun dari layout (termasuk font dan CSS variable, karena `globals.css`
 * dimuat lewat layout yang barusan gagal). Gayanya karena itu ditulis inline
 * apa adanya: satu-satunya tempat di aplikasi ini yang boleh begitu, dengan
 * alasan yang sama seperti template email.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E2419',
          color: '#F2F6F0',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 13, letterSpacing: '.08em', opacity: 0.7 }}>TOKOKU</div>
          <h1 style={{ fontSize: 22, margin: '10px 0 12px' }}>Aplikasi Gagal Dimuat</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, margin: '0 0 20px' }}>
            Data toko dan penjualan Anda tidak terpengaruh. Coba muat ulang; kalau masih sama,
            hubungi kami dan sebutkan kode di bawah.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#A1FFCE',
              color: '#0E2419',
              border: 'none',
              borderRadius: 11,
              padding: '11px 22px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Muat Ulang
          </button>
          {error.digest && (
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 16 }}>
              Kode kejadian: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
