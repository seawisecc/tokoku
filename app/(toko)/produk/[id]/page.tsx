import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { requirePermission } from '@/lib/auth'
import { cn, rupiah, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kartu Stok — TokoKu' }
export const dynamic = 'force-dynamic'

/**
 * Label pergerakan stok.
 *
 * `sync_correction` sengaja diberi kalimat sendiri, bukan disamakan dengan
 * "Koreksi": ia muncul karena transaksi offline baru sampai server belakangan,
 * dan pemilik toko yang melihat stoknya berubah tanpa ada penjualan hari itu
 * berhak tahu penyebabnya.
 */
const MOVE: Record<string, { label: string; hint?: string }> = {
  initial: { label: 'Stok awal' },
  purchase: { label: 'Barang masuk' },
  sale: { label: 'Penjualan' },
  return: { label: 'Retur / transaksi dibatalkan' },
  adjustment: { label: 'Koreksi manual' },
  opname: { label: 'Hasil opname' },
  transfer_in: { label: 'Transfer masuk' },
  transfer_out: { label: 'Transfer keluar' },
  consign_in: {
    label: 'Titipan masuk',
    hint: 'Barang konsinyasi — masih milik pemasok sampai terjual.',
  },
  consign_return: {
    label: 'Retur titipan',
    hint: 'Barang titipan yang belum laku, dikembalikan ke pemasok.',
  },
  sync_correction: {
    label: 'Koreksi sinkronisasi',
    hint: 'Transaksi yang dibuat saat perangkat offline, baru masuk belakangan.',
  },
}

const jam = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  })

/**
 * Kartu stok — riwayat masuk-keluar satu produk.
 *
 * `stock_movements` sudah dicatat sejak awal dan bersifat append-only (tidak
 * ada policy UPDATE maupun DELETE untuk siapa pun), tapi belum pernah
 * ditampilkan di mana pun. Padahal inilah yang menjawab "kenapa stoknya jadi
 * segini" — pertanyaan yang selama ini hanya bisa dijawab dengan menebak.
 */
export default async function KartuStokPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePermission('products')
  const supabase = await createClient()

  const [{ data: product }, { data: moves }] = await Promise.all([
    supabase
      .from('v_product_stock')
      .select('id, name, sku, unit, stock, min_stock, track_stock, category_name, sell_price')
      .eq('organization_id', session.org!.id)
      // WAJIB: view-nya satu baris per produk per outlet sejak migrasi 0028.
      // Tanpa saringan ini, toko dua cabang membuat maybeSingle() gagal.
      .eq('outlet_id', session.outletId!)
      .eq('id', id)
      .maybeSingle(),
    supabase
      // Disaring per OUTLET, dan itu bukan sekadar kerapian.
      //
      // Kolom "Sisa" adalah saldo berjalan, dan saldo hanya punya arti di dalam
      // satu outlet. Dicampur dua cabang, angkanya melompat-lompat (6 → 33 → 11)
      // seolah stoknya kacau — padahal masing-masing cabang runut sendiri-
      // sendiri. Transfer antar outlet menulis dua baris, satu di tiap sisi;
      // yang tampil di sini adalah sisi cabang yang sedang dibuka.
      .from('stock_movements')
      .select('id, type, quantity_delta, balance_after, note, created_at, profiles:created_by(full_name)')
      .eq('organization_id', session.org!.id)
      .eq('outlet_id', session.outletId!)
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (!product) notFound()

  const rows = moves ?? []
  const masuk = rows.filter((m) => m.quantity_delta > 0).reduce((n, m) => n + m.quantity_delta, 0)
  const keluar = rows.filter((m) => m.quantity_delta < 0).reduce((n, m) => n + m.quantity_delta, 0)

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/produk" style={{ color: 'inherit' }}>
            ← Produk &amp; Stok
          </Link>
        }
        title={product.name ?? 'Produk'}
        subtitle={`${product.sku} · ${product.category_name ?? 'Tanpa kategori'} · ${rupiah(Number(product.sell_price ?? 0))}`}
      />

      <div className="mini-stat-row" style={{ marginBottom: 18 }}>
        <div className="mini-stat">
          <b>
            {product.stock} {product.unit}
          </b>
          <span>Stok sekarang</span>
        </div>
        <div className="mini-stat">
          <b style={{ color: 'var(--color-success)' }}>+{masuk}</b>
          <span>Total masuk</span>
        </div>
        <div className="mini-stat">
          <b style={{ color: 'var(--color-coral)' }}>{keluar}</b>
          <span>Total keluar</span>
        </div>
      </div>

      {!product.track_stock && (
        <div className="empty-note" style={{ marginBottom: 16 }} role="status">
          <div style={{ flex: 1 }}>
            Produk ini disetel <strong>tanpa pelacakan stok</strong>, jadi penjualannya tidak
            mengurangi persediaan dan tidak muncul di kartu ini.
          </div>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 0 }}>
        Riwayat Pergerakan
        {rows.length >= 200 && (
          <span className="cell-sub">200 terakhir</span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="placeholder-card">
          Belum ada pergerakan stok untuk produk ini.
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="move-table">
              <thead>
                <tr>
                  <th>Kejadian</th>
                  <th>Waktu</th>
                  <th style={{ textAlign: 'right' }}>Perubahan</th>
                  <th style={{ textAlign: 'right' }}>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const meta = MOVE[m.type] ?? { label: m.type }
                  const by = (m.profiles as unknown as { full_name: string } | null)?.full_name
                  const naik = m.quantity_delta > 0
                  return (
                    <tr key={m.id}>
                      <td className="mv-what">
                        <div className="cell-name">{meta.label}</div>
                        <div className="cell-sub">
                          {m.note ?? meta.hint ?? (by ? `oleh ${by}` : '—')}
                        </div>
                      </td>
                      <td className="mv-when">
                        {tanggal(m.created_at)} · {jam(m.created_at)}
                      </td>
                      <td className="mv-delta" style={{ textAlign: 'right' }}>
                        <span
                          className={cn('badge', naik ? 'badge-growth' : 'badge-low')}
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {naik ? '+' : ''}
                          {m.quantity_delta}
                        </span>
                      </td>
                      <td className="mv-balance" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {m.balance_after} {product.unit}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 12 }}>
        Kartu stok bersifat catatan permanen — barisnya tidak bisa diubah maupun dihapus oleh
        siapa pun, termasuk pemilik toko. Kalau ada angka yang keliru, perbaiki lewat opname
        supaya koreksinya ikut tercatat.
      </p>
    </>
  )
}
