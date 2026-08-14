/**
 * Periode bulanan untuk halaman keuangan.
 *
 * SATU tempat, dipakai Pengeluaran dan Laporan Keuangan. Alasannya sama dengan
 * `org_usage` dan `lib/plan.ts`: dua halaman yang memotong waktu dengan cara
 * yang sedikit berbeda akan menampilkan dua angka untuk hal yang sama, dan yang
 * membandingkannya menyimpulkan salah satunya rusak. Aturan potongnya harus
 * ditulis sekali.
 *
 * BULANAN, bukan "7/30/90 hari" seperti Laporan Penjualan. Uang keluar berirama
 * bulan: sewa, listrik, gaji, dan langganan semuanya jatuh sekali sebulan.
 * "30 hari terakhir" pada tanggal 5 memuat dua kali sewa dan tidak satu pun
 * listrik, lalu dibandingkan dengan bulan sebelumnya yang isinya berbeda.
 */
export const PERIODE = ['bulan-ini', 'bulan-lalu', '3-bulan', '12-bulan'] as const
export type Periode = (typeof PERIODE)[number]

export const PERIODE_LABEL: Record<Periode, string> = {
  'bulan-ini': 'Bulan Ini',
  'bulan-lalu': 'Bulan Lalu',
  '3-bulan': '3 Bulan',
  '12-bulan': '12 Bulan',
}

export const periodeSah = (v: string | undefined): Periode =>
  PERIODE.includes(v as Periode) ? (v as Periode) : 'bulan-ini'

/**
 * Rentang tanggalnya dihitung dari HARI INI MENURUT JAM INDONESIA TENGAH,
 * bukan jam server.
 *
 * Function berjalan di Singapura dengan jam UTC, jadi tiap tanggal 1 antara
 * pukul 00.00 dan 08.00 WITA server masih menganggapnya bulan lalu — dan
 * pemilik toko yang membuka "Bulan Ini" pagi-pagi di tanggal 1 akan melihat
 * pengeluaran bulan kemarin tanpa satu pun petunjuk kenapa.
 *
 * Zona waktunya dipatok Asia/Makassar, sama dengan bawaan
 * `organizations.timezone`. Kalau nanti toko boleh benar-benar memilih zona
 * waktunya sendiri, nilainya harus mengalir ke sini — dan ke `v_cash_flow`
 * yang sudah membacanya dari kolom itu.
 */
export function rentangPeriode(p: Periode): { from: string; to: string } {
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })
  const [y, m] = hariIni.split('-').map(Number)

  const hari = (tahun: number, bulan: number, tgl: number) =>
    `${tahun}-${String(bulan).padStart(2, '0')}-${String(tgl).padStart(2, '0')}`
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini. UTC dipakai supaya
  // zona waktu mesin yang menjalankannya tidak ikut menggeser tanggalnya.
  const akhirBulan = (tahun: number, bulan: number) =>
    new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()

  if (p === 'bulan-lalu') {
    const tahun = m === 1 ? y - 1 : y
    const bulan = m === 1 ? 12 : m - 1
    return { from: hari(tahun, bulan, 1), to: hari(tahun, bulan, akhirBulan(tahun, bulan)) }
  }

  const mundur = p === '3-bulan' ? 2 : p === '12-bulan' ? 11 : 0
  const totalBulan = m - 1 - mundur
  const tahunAwal = y + Math.floor(totalBulan / 12)
  const bulanAwal = (((totalBulan % 12) + 12) % 12) + 1

  return { from: hari(tahunAwal, bulanAwal, 1), to: hari(y, m, akhirBulan(y, m)) }
}

/** "Agustus 2026" dari "2026-08-01". Dipakai judul baris tabel bulanan. */
export function namaBulan(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
