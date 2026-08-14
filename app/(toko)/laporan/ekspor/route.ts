import { getSessionContext } from '@/lib/auth'
import { csvResponse } from '@/lib/exports'
import { buildReportExport, JENIS_LAPORAN, type JenisLaporan } from '@/lib/report-exports'
import { getPlanFeatures } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/**
 * Unduh satu laporan sebagai CSV.
 *
 * Route Handler, bukan Server Action, dengan alasan yang sama seperti ekspor
 * backup: yang diminta adalah BERKAS, dan `Content-Disposition` cuma bisa
 * dikirim dari sini.
 *
 * Rentang tanggalnya diterima APA ADANYA dari halaman, bukan dihitung ulang di
 * sini dari nama periode. Halaman Penjualan memotong waktu dalam hitungan hari
 * sementara Keuangan dan Pengeluaran memotongnya per bulan; kalau route ini
 * ikut menafsirkan sendiri, suatu hari berkasnya akan memuat rentang yang
 * berbeda dari angka yang barusan dilihat orangnya di layar. Berkas yang
 * berbeda dari layarnya lebih buruk daripada tidak ada berkas.
 */
export async function GET(request: Request) {
  const session = await getSessionContext()

  // TIDAK me-redirect ke halaman masuk: yang memanggil adalah tautan unduh, dan
  // halaman HTML yang mendarat di dalam berkas .csv terbaca sebagai berkas rusak.
  if (!session?.org) {
    return new Response('Sesi sudah berakhir. Masuk lagi lalu ulangi.', { status: 401 })
  }
  if (!session.permissions.reports) {
    return new Response('Akun ini tidak berhak mengunduh laporan.', { status: 403 })
  }

  const url = new URL(request.url)
  const jenisParam = url.searchParams.get('jenis') ?? ''
  if (!JENIS_LAPORAN.includes(jenisParam as JenisLaporan)) {
    return new Response('Jenis laporan tidak dikenali.', { status: 400 })
  }
  const jenis = jenisParam as JenisLaporan

  const dari = url.searchParams.get('dari') ?? ''
  const sampai = url.searchParams.get('sampai') ?? ''
  if (!TANGGAL.test(dari) || !TANGGAL.test(sampai) || dari > sampai) {
    return new Response('Rentang tanggalnya tidak sah.', { status: 400 })
  }

  /**
   * Gerbang paket yang SAMA dengan halamannya.
   *
   * Tanpa ini, toko paket Starter yang melihat Laporan Keuangan sebagai
   * `PlanLock` tetap bisa mengunduh isinya dengan mengetik URL — dan tautan
   * unduh itu satu-satunya jalur di aplikasi ini yang mengirim angka jadi ke
   * luar tanpa melewati render halaman.
   */
  if (jenis === 'laba-rugi' || jenis === 'arus-kas') {
    const features = await getPlanFeatures(session.org.id)
    if (features.reports !== 'full') {
      return new Response('Laporan keuangan tersedia mulai paket Growth.', { status: 403 })
    }
  }

  // Outlet asing dijatuhkan ke outlet aktif, bukan dijadikan error — aturan
  // yang sama dengan halaman Laporan.
  const diminta = url.searchParams.get('outlet')
  const outletId =
    diminta === 'semua'
      ? null
      : diminta && session.outlets.some((o) => o.id === diminta)
        ? diminta
        : session.outletId

  const supabase = await createClient()
  try {
    const { filename, csv } = await buildReportExport(
      supabase,
      session.org.id,
      session.org.name,
      jenis,
      { dari, sampai, outletId },
    )
    return csvResponse(filename, csv)
  } catch {
    // Kegagalan TIDAK boleh menjadi berkas CSV kosong: yang mengunduhnya akan
    // menyimpulkan periode itu memang tidak ada datanya.
    return new Response('Laporan gagal disusun. Coba lagi sebentar lagi.', { status: 500 })
  }
}
