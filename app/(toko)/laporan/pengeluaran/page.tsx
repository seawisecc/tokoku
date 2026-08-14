import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { LaporanTabs } from '@/components/domain/LaporanTabs'
import { ExpenseManager, type ExpenseRow } from '@/components/domain/ExpenseManager'
import { ExportReportButton } from '@/components/domain/ExportReportButton'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn } from '@/lib/format'
import { PERIODE, PERIODE_LABEL, periodeSah, rentangPeriode } from '@/lib/period'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pengeluaran | TokoKu' }
export const dynamic = 'force-dynamic'

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
  const aktif = periodeSah(periode)
  const { from, to } = rentangPeriode(aktif)

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
  const [{ data: expenses, error: gagalExpenses }, { data: categories, error: gagalKategori }] =
    await Promise.all([
    supabase
      .from('expenses')
      /**
       * Embed-nya menyebut NAMA CONSTRAINT, bukan nama kolom.
       *
       * `expense_categories:category_id(...)` adalah bentuk yang dipakai di
       * seluruh project ini dan di sini ia GAGAL, karena migrasi 0044 mengganti
       * foreign key satu kolom dengan FK KOMPOSIT `(organization_id,
       * category_id)`. Petunjuk berupa satu nama kolom tidak cocok dengan FK
       * dua kolom, jadi PostgREST menjawab "Could not find a relationship" dan
       * SELURUH query gagal — bukan cuma kolom kategorinya yang kosong.
       */
      .select('id, expense_date, amount, payment_method, payee, note, outlet_id, expense_categories!expenses_category_same_org(id, name)')
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

  /**
   * Query yang gagal TIDAK boleh tampil sebagai "belum ada pengeluaran".
   *
   * Inilah yang menyembunyikan cacat embed di atas: `{ data }` diambil dan
   * `error` dibuang, jadi pengeluaran Rp 700.000 yang sudah tersimpan rapi di
   * database tampil sebagai daftar kosong, dan yang mencatatnya menyimpulkan
   * simpanannya gagal. Untuk halaman uang, "tidak ada apa-apa" dan "saya tidak
   * bisa membacanya" adalah dua kalimat yang berbeda dan tidak boleh terlihat
   * sama.
   */
  const gagal = gagalExpenses ?? gagalKategori
  if (gagal) {
    return (
      <>
        <LaporanTabs />
        <PageHeader
          eyebrow={session.org!.name}
          title="Pengeluaran"
          subtitle="Biaya yang tidak menambah stok: sewa, listrik, gaji, transportasi."
        />
        <div className="empty-note" role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            Daftar pengeluaran gagal dimuat, jadi yang tampil di sini belum tentu lengkap. Muat
            ulang halamannya; kalau masih sama, hubungi admin TokoKu. Catatan yang sudah tersimpan
            tidak hilang.
          </div>
        </div>
      </>
    )
  }

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
        action={
          <ExportReportButton
            pilihan={[{ jenis: 'pengeluaran', label: 'Pengeluaran' }]}
            dari={from}
            sampai={to}
          />
        }
      />

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {PERIODE.map((p) => (
          <Link
            key={p}
            href={`/laporan/pengeluaran?periode=${p}` as Route}
            className={cn('btn btn-sm', p === aktif ? 'btn-dark' : 'btn-ghost')}
            style={{ textDecoration: 'none' }}
          >
            {PERIODE_LABEL[p]}
          </Link>
        ))}
      </div>

      <ExpenseManager
        expenses={rows}
        categories={categories ?? []}
        outlets={session.outlets.length > 1 ? session.outlets.map((o) => ({ id: o.id, name: o.name })) : []}
        periodLabel={PERIODE_LABEL[aktif].toLowerCase()}
      />
    </>
  )
}
