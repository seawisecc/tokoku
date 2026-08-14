import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { requireSession } from '@/lib/auth'
import { jam, rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { TransactionTable } from '@/components/domain/TransactionTable'
import { DataError } from '@/components/domain/DataError'

export const metadata: Metadata = { title: 'Riwayat | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function RiwayatPage() {
  const session = await requireSession()
  const supabase = await createClient()

  // Filter cashier_id ini sebenarnya berlebihan — policy trx_read sudah
  // membatasi kasir hanya melihat transaksinya sendiri. Ditulis eksplisit
  // supaya maksudnya jelas dibaca, dan tetap benar kalau nanti halaman ini
  // dibuka oleh pemilik yang policy-nya lebih longgar.
  const { data, error } = await supabase
    .from('transactions')
    .select('id, code, total, status, payment_method, origin, client_created_at')
    .eq('organization_id', session.org!.id)
    .eq('outlet_id', session.outletId!)
    .eq('cashier_id', session.userId)
    .order('client_created_at', { ascending: false })
    .limit(50)

  const rows = (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    time: jam(t.client_created_at),
    cashier: session.fullName,
    method: t.payment_method,
    origin: t.origin,
    total: rupiah(t.total),
    status: t.status,
  }))

  return (
    <>
      <PageHeader
        eyebrow={session.fullName}
        title="Riwayat Transaksi"
        subtitle="Transaksi yang kamu proses."
      />
      {error ? <DataError apa="Riwayat transaksi" /> : <TransactionTable rows={rows} />}
    </>
  )
}
