import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { requirePermission } from '@/lib/auth'
import { jam, rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { TransactionTable } from '@/components/domain/TransactionTable'

export const metadata: Metadata = { title: 'Transaksi — TokoKu' }
export const dynamic = 'force-dynamic'

export default async function TransaksiPage() {
  const session = await requirePermission('reports')
  const supabase = await createClient()

  const { data } = await supabase
    // Per outlet aktif, sama seperti seluruh aplikasi. Dicampur dua cabang,
    // daftar ini tidak menyebut satu pun kolom yang membedakan asalnya — nomor
    // transaksinya memang membawa kode perangkat, tapi tidak ada yang bisa
    // membaca cabang dari situ.
    .from('transactions')
    .select('id, code, total, status, payment_method, origin, client_created_at, profiles:cashier_id(full_name)')
    .eq('organization_id', session.org!.id)
    .eq('outlet_id', session.outletId!)
    .order('client_created_at', { ascending: false })
    .limit(50)

  const rows = (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    time: jam(t.client_created_at),
    cashier: (t.profiles as { full_name: string } | null)?.full_name ?? 'Kasir',
    method: t.payment_method,
    origin: t.origin,
    total: rupiah(t.total),
    status: t.status,
  }))

  return (
    <>
      <PageHeader
        eyebrow={session.org!.name}
        title="Transaksi"
        subtitle="Riwayat seluruh transaksi kasir."
      />
      <TransactionTable rows={rows} showCashier />
    </>
  )
}
