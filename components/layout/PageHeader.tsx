/**
 * `action` duduk SEJAJAR dengan judul halaman, di ujung kanan.
 *
 * Sebelumnya tombol unduh ditaruh sebagai baris tersendiri di bawah pemilih
 * periode, dan di sana ia berebut perhatian dengan tombol-tombol yang justru
 * mengubah isi layar. Tempatnya yang benar adalah di samping judul: ia
 * tindakan ATAS halaman ini, bukan salah satu pilihan di dalamnya.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: React.ReactNode
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="page-head">
      <div className="page-head-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
