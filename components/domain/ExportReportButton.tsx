import type { Route } from 'next'
import { Icon } from '@/components/ui/icons'
import type { JenisLaporan } from '@/lib/report-exports'

/**
 * Tombol unduh CSV untuk satu laporan.
 *
 * Tautan biasa ber-`download`, bukan tombol ber-JavaScript. Yang dikirim server
 * adalah berkas dan browser sudah tahu cara menyimpannya; merakitnya jadi blob
 * di sisi klien berarti seluruh isi laporan harus muat di memori ponsel dulu.
 * Alasan yang sama dengan kartu unduh di halaman Impor & Backup.
 *
 * Rentang tanggalnya dioper dari halaman, bukan disusun ulang di sini. Itu yang
 * membuat isi berkasnya pasti sama dengan angka yang sedang dilihat orangnya.
 */
export function ExportReportButton({
  jenis,
  dari,
  sampai,
  outlet,
  label = 'Unduh CSV',
}: {
  jenis: JenisLaporan
  dari: string
  sampai: string
  /** id outlet, 'semua', atau kosong untuk mengikuti outlet aktif. */
  outlet?: string
  label?: string
}) {
  const href =
    `/laporan/ekspor?jenis=${jenis}&dari=${dari}&sampai=${sampai}` +
    (outlet ? `&outlet=${outlet}` : '')

  return (
    <a href={href as Route} className="btn btn-ghost btn-sm" download style={{ textDecoration: 'none' }}>
      <Icon name="chevronDown" size={13} /> {label}
    </a>
  )
}
