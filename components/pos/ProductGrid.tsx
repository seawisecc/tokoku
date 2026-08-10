'use client'

import { cn, rupiah } from '@/lib/format'
import type { CatalogEntry } from '@/lib/offline/catalog'

export function ProductGrid({
  products,
  inCart,
  allowNegativeStock,
  onPick,
}: {
  products: CatalogEntry[]
  inCart: Record<string, number>
  allowNegativeStock: boolean
  onPick: (p: CatalogEntry) => void
}) {
  if (products.length === 0) {
    return <div className="placeholder-card" style={{ marginTop: 12 }}>Tidak ada produk cocok.</div>
  }

  return (
    <div className="pos-grid">
      {products.map((p) => {
        const taken = inCart[p.id] ?? 0
        const remaining = p.stock - taken
        // Blokir hanya kalau toko memang melarang stok minus. Kalau diizinkan,
        // kasir tetap boleh menjual — barangnya mungkin ada di rak walau
        // catatannya belum tersinkron.
        const blocked = p.track_stock && remaining <= 0 && !allowNegativeStock

        return (
          <button
            key={p.id}
            type="button"
            className="prod-card"
            disabled={blocked}
            onClick={() => onPick(p)}
            style={blocked ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            <div className={cn('prod-thumb', `cat-${p.color_key ?? 'default'}`)}>
              {p.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="prod-name">{p.name}</div>
            <div className="prod-price">{rupiah(p.sell_price)}</div>
            <div className="prod-stock">
              {p.track_stock ? `Stok: ${remaining}` : 'Tanpa stok'}
              {taken > 0 && <span style={{ color: 'var(--color-forest)' }}> · {taken} di keranjang</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
