'use client'

import Link from 'next/link'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProduct } from '@/app/(toko)/produk/actions'
import { IconAction } from '@/components/data/IconAction'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'
import { ProductDrawer, emptyProduct, type ProductFormValue } from './ProductDrawer'
import { StockDrawer, type StockTarget } from './StockDrawer'

export type ProductRow = {
  id: string
  name: string
  sku: string
  barcode: string | null
  categoryId: string | null
  categoryName: string | null
  colorKey: string | null
  unit: string
  costPrice: number
  sellPrice: number
  minStock: number
  trackStock: boolean
  stock: number
  isLowStock: boolean
}

export function ProductTable({
  products,
  categories,
  canEdit,
}: {
  products: ProductRow[]
  categories: { id: string; name: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua')
  const [editing, setEditing] = useState<ProductFormValue | null>(null)
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'Semua' && p.categoryName !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, query, category])

  /** SKU berikutnya diusulkan dari yang tertinggi supaya tidak bentrok. */
  function suggestSku(): string {
    const nums = products
      .map((p) => /(\d+)$/.exec(p.sku)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    return `PRD-${String(next).padStart(4, '0')}`
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="table-card">
        <div className="table-toolbar">
          <div className="tf-input" style={{ flex: '1 1 200px' }}>
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, SKU, atau barcode…"
              aria-label="Cari produk"
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Semua', ...categories.map((c) => c.name)].map((c) => (
              <button
                key={c}
                type="button"
                className="btn btn-ghost btn-sm"
                style={
                  category === c
                    ? {
                        background: 'var(--color-forest)',
                        color: 'var(--color-mint)',
                        borderColor: 'var(--color-forest)',
                      }
                    : undefined
                }
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing(emptyProduct(suggestSku()))}
            >
              <Icon name="plus" size={15} /> Tambah Produk
            </button>
          )}
        </div>

        {notice && (
          <div className="empty-note" style={{ margin: '14px 16px' }} role="alert">
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{notice}</div>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            {products.length === 0
              ? 'Belum ada produk. Tambahkan yang pertama lewat tombol di atas.'
              : 'Tidak ada produk yang cocok dengan pencarian.'}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Harga Pokok</th>
                  <th>Harga Jual</th>
                  <th>Stok</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="row-flex">
                        <div className={cn('cat-chip', `cat-${p.colorKey ?? 'default'}`)}>
                          {(p.categoryName ?? '??').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          {/* Nama produk jadi jalan masuk ke kartu stok —
                              tanpa menambah tombol baru di baris yang sudah
                              padat, dan tetap ketemu di layar sempit. */}
                          <Link href={`/produk/${p.id}`} className="cell-name">
                            {p.name}
                          </Link>
                          <div className="cell-sub mono">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>{rupiah(p.costPrice)}</td>
                    <td style={{ fontWeight: 700 }}>{rupiah(p.sellPrice)}</td>
                    <td>
                      {p.trackStock ? (
                        <span className={cn('badge', p.isLowStock ? 'badge-low' : 'badge-ok')}>
                          {p.stock} {p.unit}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-faint)' }}>tanpa stok</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="row-actions">
                          {p.trackStock && (
                            <IconAction
                              icon="layers"
                              label="Sesuaikan stok"
                              onClick={() =>
                                setStockTarget({
                                  id: p.id,
                                  name: p.name,
                                  sku: p.sku,
                                  stock: p.stock,
                                  unit: p.unit,
                                })
                              }
                            />
                          )}
                          <IconAction
                            icon="edit"
                            label="Edit"
                            onClick={() =>
                              setEditing({
                                id: p.id,
                                name: p.name,
                                sku: p.sku,
                                barcode: p.barcode,
                                categoryId: p.categoryId,
                                unit: p.unit,
                                costPrice: p.costPrice,
                                sellPrice: p.sellPrice,
                                minStock: p.minStock,
                                trackStock: p.trackStock,
                              })
                            }
                          />
                          <IconAction
                            icon="trash"
                            label="Hapus"
                            danger
                            confirm
                            onClick={async () => {
                              const res = await deleteProduct(p.id)
                              if (!res.ok) setNotice(res.error)
                              else {
                                setNotice(null)
                                refresh()
                              }
                            }}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* `key` memaksa mount ulang tiap kali drawer dibuka. Tanpa itu, state
          awal form hanya dihitung sekali — saat drawer masih tertutup dan
          datanya null — sehingga membuka produk mana pun menampilkan form kosong. */}
      {editing && (
        <ProductDrawer
          key={editing.id ?? 'baru'}
          value={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setNotice(null)
            refresh()
          }}
        />
      )}

      {stockTarget && (
        <StockDrawer
          key={stockTarget.id}
          target={stockTarget}
          onClose={() => setStockTarget(null)}
          onSaved={() => {
            setStockTarget(null)
            refresh()
          }}
        />
      )}
    </>
  )
}
