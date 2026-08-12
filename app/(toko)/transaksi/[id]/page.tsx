import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Receipt } from '@/components/pos/Receipt'
import { PrintButton } from '@/components/pos/PrintButton'
import { VoidTransactionButton } from '@/components/domain/VoidTransactionButton'
import { SendReceiptButton } from '@/components/domain/SendReceiptButton'
import { Icon } from '@/components/ui/icons'
import { requireSession } from '@/lib/auth'
import { jam, rupiah, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Detail Transaksi | TokoKu' }
export const dynamic = 'force-dynamic'

export default async function DetailTransaksiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()
  const supabase = await createClient()

  const { data: trx } = await supabase
    .from('transactions')
    .select(
      'id, code, total, subtotal, discount_total, tax_total, paid_amount, change_amount, payment_method, status, origin, client_created_at, void_reason, profiles:cashier_id(full_name), outlets:outlet_id(name, receipt_settings), organizations:organization_id(name, address, phone, logo_url), customers:customer_id(name, phone)',
    )
    .eq('id', id)
    .maybeSingle()

  // RLS sudah memfilter; kalau tidak terbaca, perlakukan sebagai tidak ada.
  if (!trx) notFound()

  const { data: items } = await supabase
    .from('transaction_items')
    .select('product_name, quantity, unit_price, discount, line_total')
    .eq('transaction_id', id)
    .order('line_no')

  const org = trx.organizations as unknown as {
    name: string
    address: string | null
    phone: string | null
    logo_url: string | null
  } | null
  const outlet = trx.outlets as unknown as {
    name: string
    receipt_settings: { footer?: string; show_logo?: boolean } | null
  } | null
  const cashier = (trx.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Kasir'
  const pembeli = trx.customers as unknown as { name: string; phone: string | null } | null

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/transaksi" style={{ color: 'inherit' }}>
            ← Transaksi
          </Link>
        }
        title="Detail Transaksi"
        subtitle={`${tanggal(trx.client_created_at)} · ${jam(trx.client_created_at)}`}
      />

      {/* Dulu selalu satu kolom: kartu rincian melar penuh dan struknya jatuh
          jauh di bawah, padahal keduanya dibaca berdampingan saat mencocokkan
          nota. Lihat `.trx-detail` di globals.css. */}
      <div className="trx-detail">
        <div className="card">
          <div className="kv">
            <span>No. Transaksi</span>
            <span className="mono">{trx.code}</span>
          </div>
          <div className="kv">
            <span>Kasir</span>
            <span>{cashier}</span>
          </div>
          <div className="kv">
            <span>Metode</span>
            <span>{trx.payment_method === 'qris' ? 'QRIS' : 'Tunai'}</span>
          </div>
          <div className="kv">
            <span>Asal</span>
            <span>{trx.origin === 'offline' ? 'Dibuat offline' : 'Online'}</span>
          </div>
          <div className="kv">
            <span>Status</span>
            <span className={`badge ${trx.status === 'void' ? 'badge-low' : 'badge-active'}`}>
              {trx.status === 'void' ? 'Dibatalkan' : 'Lunas'}
            </span>
          </div>
          {trx.void_reason && (
            <div className="empty-note" style={{ marginTop: 12 }}>
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>Alasan pembatalan: {trx.void_reason}</div>
            </div>
          )}

          <div className="section-title" style={{ marginTop: 18 }}>Item</div>
          {(items ?? []).map((it, i) => (
            <div className="kv" key={i}>
              <span>
                {it.product_name}
                <span style={{ color: 'var(--color-ink-faint)' }}> × {it.quantity}</span>
              </span>
              <span>{rupiah(it.line_total)}</span>
            </div>
          ))}
          <div className="kv" style={{ fontSize: 15 }}>
            <span>Total</span>
            <span>{rupiah(trx.total)}</span>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            <PrintButton />
            {/* Nota batal tidak boleh dikirim: pembeli akan memegang bukti
                pembayaran atas transaksi yang uangnya sudah dikembalikan.
                Alasannya sama dengan penanda batal di struk cetak. */}
            {trx.status === 'paid' && (
              <SendReceiptButton
                customerName={pembeli?.name ?? null}
                customerPhone={pembeli?.phone ?? null}
                data={{
                  storeName: org?.name ?? 'Toko',
                  storeAddress: org?.address ?? null,
                  storePhone: org?.phone ?? null,
                  outletName: outlet?.name ?? null,
                  code: trx.code,
                  at: trx.client_created_at,
                  cashierName: cashier,
                  items: (items ?? []).map((it) => ({
                    name: it.product_name,
                    qty: it.quantity,
                    unitPrice: it.unit_price,
                    lineTotal: it.line_total,
                  })),
                  subtotal: trx.subtotal,
                  discount: trx.discount_total,
                  total: trx.total,
                  paid: trx.paid_amount,
                  change: trx.change_amount,
                  paymentMethod: trx.payment_method,
                  footer: outlet?.receipt_settings?.footer ?? null,
                }}
              />
            )}
            {trx.status === 'paid' && session.permissions.reports && (
              <VoidTransactionButton trxId={trx.id} code={trx.code} />
            )}
          </div>
        </div>

        <div className="receipt-preview">
          <Receipt
            data={{
              code: trx.code,
              storeName: org?.name ?? 'Toko',
              logoUrl:
                outlet?.receipt_settings?.show_logo === false ? null : (org?.logo_url ?? null),
              storeAddress: org?.address ?? null,
              storePhone: org?.phone ?? null,
              outletName: outlet?.name ?? null,
              cashierName: cashier,
              at: trx.client_created_at,
              paymentMethod: trx.payment_method,
              items: (items ?? []).map((it) => ({
                name: it.product_name,
                qty: it.quantity,
                unitPrice: it.unit_price,
                lineTotal: it.line_total,
              })),
              subtotal: trx.subtotal,
              discount: trx.discount_total,
              tax: trx.tax_total,
              total: trx.total,
              paid: trx.paid_amount,
              change: trx.change_amount,
              footer: outlet?.receipt_settings?.footer ?? null,
              offline: trx.origin === 'offline',
              voided: trx.status === 'void',
            }}
          />
        </div>
      </div>
    </>
  )
}
