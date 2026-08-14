import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { LaporanTabs } from '@/components/domain/LaporanTabs'
import { ExpenseManager, type ExpenseRow } from '@/components/domain/ExpenseManager'
import { requirePermission } from '@/lib/auth'
import { cn } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengeluaran | TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Periodenya BULANAN, bukan "7/30/90 hari" seperti Laporan Penjualan.
 *
 * Pengeluaran memang berirama bulan: sewa, listrik, gaji, dan langganan semua
 * jatuh sekali sebulan. "30 hari terakhir" pada tanggal 5 memuat dua kali sewa
 * dan tidak ada satu pun listrik, lalu angkanya dibandingkan dengan bulan lalu
 * yang isinya berbeda. Laba rugi di fase berikutnya juga bulanan, dan dua
 * halaman yang memotong waktu dengan cara berbeda tidak akan pernah cocok
 * angkanya.
 */
const PERIODE = ['bulan-ini', 'bulan-lalu', '3-bulan', '12-bulan'] as const
type Periode = (typeof PERIODE)[number]

const LABEL: Record<Periode, string> = {
  'bulan-ini': 'Bulan Ini',
  'bulan-lalu': 'Bulan Lalu',
  '3-bulan': '3 Bulan',
  '12-bulan': '12 Bulan',
}

/**
 * Rentang tanggalnya dihitung dari HARI INI MENURUT JAM INDONESIA TENGAH,
 * bukan jam server. Function berjalan di Singapura dengan jam UTC, jadi tiap
 * tanggal 1 antara pukul 00.00 dan 08.00 WITA server masih menganggapnya bulan
 * lalu — dan pemilik toko yang membuka "Bulan Ini" pagi-pagi di tanggal 1 akan
 * melihat pengeluaran bulan kemarin.
 */
function rentang(p: Periode): { from: string; to: string } {
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })
  const [y, m] = hariIni.split('-').map(Number)
  const hari = (tahun: number, bulan: number, tgl: number) =>
    `${tahun}-${String(bulan).padStart(2, '0')}-${String(tgl).padStart(2, '0')}`
  const akhirBulan = (tahun: number, bulan: number) => new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()

  if (p === 'bulan-lalu') {
    const tahun = m === 1 ? y - 1 : y
    const bulan = m === 1 ? 12 : m - 1
    return { from: hari(tahun, bulan, 1), to: hari(tahun, bulan, akhirBulan(tahun, bulan)) }
  }

  const mundur = p === '3-bulan' ? 2 : p === '12-bulan' ? 11 : 0
  const totalBulan = m - 1 - mundur
  const tahunAwal = y + Math.floor(totalBulan / 12)
  const bulanAwal = ((totalBulan % 12) + 12) % 12 + 1

  return { from: hari(tahunAwal, bulanAwal, 1), to: hari(y, m, akhirBulan(y, m)) }
}

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  // Izin `reports`, sama dengan pembatalan transaksi. Di aplikasi ini itulah
  // izin "boleh menyentuh uang" — dan halaman ini tinggal di bawah Laporan
  // justru supaya izin menu dan izin halamannya tidak pernah bisa berbeda.
  const session = await requirePermission('reports')
  const { periode } = await searchParams
  const aktif: Periode = PERIODE.includes(periode as Periode) ? (periode as Periode) : 'bulan-ini'
  const { from, to } = rentang(aktif)

  const supabase = await createClient()
  const orgId = session.org!.id

  /**
   * SENGAJA tidak disaring per outlet aktif, dan ini mengikuti aturan yang
   * sudah berlaku untuk Pembelian: pengeluaran dibayar dari kas yang sama oleh
   * orang yang sama. Disaring per cabang, tagihan listrik cabang lain hilang
   * dari pandangan tanpa ada apa pun di layar yang memberi tahu ada yang
   * disembunyikan. Yang dibutuhkan LABEL cabang, bukan saringan.
   *
   * Baris ber-`outlet_id` NULL memang milik seluruh toko, jadi ia harus selalu
   * ikut terhitung.
   */
  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, expense_date, amount, payment_method, payee, note, outlet_id, expense_categories:category_id(id, name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('expense_categories')
      .select('id, name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('sort_order')
      .order('name'),
  ])

  // Nama cabang hanya disebut kalau tokonya memang bercabang.
  const namaOutlet = new Map(
    session.outlets.length > 1 ? session.outlets.map((o) => [o.id, o.name]) : [],
  )

  const rows: ExpenseRow[] = (expenses ?? []).map((e) => {
    const kategori = e.expense_categories as unknown as { id: string; name: string } | null
    return {
      id: e.id,
      expenseDate: e.expense_date,
      amount: Number(e.amount ?? 0),
      paymentMethod: e.payment_method,
      payee: e.payee,
      note: e.note,
      categoryId: kategori?.id ?? '',
      categoryName: kategori?.name ?? 'Tanpa kategori',
      outletId: e.outlet_id,
      outletName: e.outlet_id ? (namaOutlet.get(e.outlet_id) ?? null) : null,
    }
  })

  return (
    <>
      <LaporanTabs />
      <PageHeader
        eyebrow={session.org!.name}
        title="Pengeluaran"
        subtitle="Biaya yang tidak menambah stok: sewa, listrik, gaji, transportasi."
      />

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PERIODE.map((p) => (
          <Link
            key={p}
            href={`/laporan/pengeluaran?periode=${p}` as Route}
            className={cn('btn btn-sm', p === aktif ? 'btn-dark' : 'btn-ghost')}
            style={{ textDecoration: 'none' }}
          >
            {LABEL[p]}
          </Link>
        ))}
      </div>

      <ExpenseManager
        expenses={rows}
        categories={categories ?? []}
        outlets={session.outlets.length > 1 ? session.outlets.map((o) => ({ id: o.id, name: o.name })) : []}
        periodLabel={LABEL[aktif].toLowerCase()}
      />
    </>
  )
}
