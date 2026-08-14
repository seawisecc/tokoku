import type { Metadata } from 'next'
import { AutoPrint } from '@/components/pos/AutoPrint'
import { requirePermission } from '@/lib/auth'
import { tanggal } from '@/lib/format'
import { getPlanFeatures } from '@/lib/plan'
import {
  buildReportData,
  JENIS_LAPORAN,
  JUDUL_LAPORAN,
  type JenisLaporan,
  type KolomJenis,
} from '@/lib/report-exports'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Cetak Laporan | TokoKu' }
export const dynamic = 'force-dynamic'

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/**
 * Pemisah ribuan HANYA di lembar cetak, tidak pernah di CSV.
 *
 * Dilaporkan pemilik project: angka jutaan tanpa titik praktis tidak terbaca di
 * atas kertas, dan yang membacanya harus menghitung digit dengan jari. Di CSV
 * justru sebaliknya — begitu ribuannya diberi titik, Excel berlokal Inggris
 * membacanya sebagai teks dan seluruh gunanya sebagai berkas yang bisa dihitung
 * ulang hilang. Karena itu pemformatan hidup di sini, bukan di penyusun datanya.
 */
const ribuan = new Intl.NumberFormat('id-ID')

/** Jam dipakai kolom `waktu`; tanpa ini kolom Dibuka/Ditutup tercetak ISO mentah. */
const jam = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  })

function sel(nilai: unknown, jenis: KolomJenis): string {
  if (nilai === null || nilai === undefined || nilai === '') return '-'
  if (jenis === 'uang' || jenis === 'angka') {
    const n = Number(nilai)
    return Number.isFinite(n) ? ribuan.format(n) : String(nilai)
  }
  if (jenis === 'tanggal') return tanggal(String(nilai))
  if (jenis === 'waktu') return jam(String(nilai))
  return String(nilai)
}

/**
 * Lembar cetak laporan. Inilah jalur PDF-nya.
 *
 * TIDAK memakai pustaka PDF, dan itu keputusan. Yang dibutuhkan adalah tabel
 * teks di atas kertas putih, dan setiap browser sudah punya "Simpan sebagai
 * PDF" di dialog cetaknya, di ponsel maupun di komputer. Satu dependensi
 * pembuat PDF berarti satu paket lagi yang harus ikut diaudit seumur hidup
 * project ini, demi sesuatu yang sudah ada di alat yang dipegang orangnya.
 * Pola yang sama dengan struk 58mm yang sudah dipakai sejak awal.
 *
 * Angkanya datang dari `buildReportData`, penyusun yang SAMA dengan yang
 * dipakai unduhan CSV. Kalau keduanya menghitung sendiri-sendiri, suatu hari
 * PDF dan CSV untuk periode yang sama akan berbeda isinya.
 */
export default async function CetakLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string; dari?: string; sampai?: string; outlet?: string }>
}) {
  const session = await requirePermission('reports')
  const { jenis: jenisParam, dari = '', sampai = '', outlet } = await searchParams

  const jenis = (JENIS_LAPORAN.includes(jenisParam as JenisLaporan)
    ? jenisParam
    : 'penjualan') as JenisLaporan

  if (!TANGGAL.test(dari) || !TANGGAL.test(sampai) || dari > sampai) {
    return <p className="cetak-kosong">Rentang tanggalnya tidak sah.</p>
  }

  // Gerbang paket yang sama dengan halaman dan rute unduh. Lembar cetak juga
  // mengeluarkan angka jadi ke luar aplikasi.
  if (jenis === 'laba-rugi' || jenis === 'arus-kas') {
    const features = await getPlanFeatures(session.org!.id)
    if (features.reports !== 'full') {
      return <p className="cetak-kosong">Laporan keuangan tersedia mulai paket Growth.</p>
    }
  }

  const outletId =
    outlet === 'semua'
      ? null
      : outlet && session.outlets.some((o) => o.id === outlet)
        ? outlet
        : session.outletId

  const supabase = await createClient()
  let data
  try {
    data = await buildReportData(supabase, session.org!.id, session.org!.name, jenis, {
      dari,
      sampai,
      outletId,
    })
  } catch {
    // Kegagalan TIDAK boleh berubah jadi lembar kosong yang ikut tercetak:
    // yang memegang kertasnya akan menyimpulkan periode itu memang sepi.
    return (
      <p className="cetak-kosong">
        Laporan gagal disusun, jadi tidak ada yang bisa dicetak. Coba lagi sebentar lagi.
      </p>
    )
  }

  const namaOutlet = outletId
    ? (session.outlets.find((o) => o.id === outletId)?.name ?? null)
    : 'Semua outlet'

  return (
    <>
      {/* Dialog cetak dibuka sendiri, dijaga useRef supaya StrictMode tidak
          memunculkannya dua kali. Komponen yang sama dipakai struk. */}
      <AutoPrint aktif />

      <div className="cetak-lembar">
        <div className="cetak-kop">
          <div>
            <div className="cetak-toko">{session.org!.name}</div>
            <h1 className="cetak-judul">{JUDUL_LAPORAN[jenis]}</h1>
          </div>
          <div className="cetak-meta">
            <div>
              {tanggal(dari)} sampai {tanggal(sampai)}
            </div>
            {session.outlets.length > 1 && namaOutlet && <div>{namaOutlet}</div>}
            <div>Dicetak {tanggal(new Date().toISOString())}</div>
          </div>
        </div>

        {data.rows.length === 0 ? (
          <p className="cetak-kosong">Tidak ada data pada periode ini.</p>
        ) : (
          <table className="cetak-tabel">
            <thead>
              <tr>
                {data.headers.map((h, j) => {
                  const jenis = data.kolom[j]
                  const angka = jenis === 'uang' || jenis === 'angka'
                  return (
                    <th key={h} className={angka ? 'ka' : undefined}>
                      {/* Satuan rupiah disebut SEKALI di kepala kolom, bukan
                          diulang "Rp" di tiap sel. Di tabel berisi belasan baris
                          angka, pengulangan itu justru membuat digitnya lebih
                          sulit disejajarkan mata. */}
                      {h}
                      {jenis === 'uang' ? ' (Rp)' : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((nilai, j) => {
                    const jenis = data.kolom[j] ?? 'teks'
                    const angka = jenis === 'uang' || jenis === 'angka'
                    return (
                      <td key={j} className={angka ? 'ka' : undefined}>
                        {sel(nilai, jenis)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="cetak-kaki">
          Dibuat otomatis oleh TokoKu. Angka pada lembar ini mengikuti periode dan cakupan yang
          diminta, dan sama dengan yang tampil di layar laporan.
        </p>
      </div>
    </>
  )
}
