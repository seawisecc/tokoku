import { rupiah } from '@/lib/format'

export type RankItem = { id: string; label: string; value: number; sub?: string }

/**
 * Peringkat — batang horizontal, satu seri.
 *
 * Nama produk panjang dan tidak muat di sumbu X; batang horizontal memberi
 * ruang teks penuh. Nilainya ditulis langsung di setiap baris karena jumlah
 * barisnya sedikit dan angkanya justru yang dicari pemilik toko.
 */
export function RankedBars({ items, formatValue = rupiah }: { items: RankItem[]; formatValue?: (n: number) => string }) {
  if (items.length === 0) {
    return <div className="placeholder-card" style={{ border: 'none' }}>Belum ada data.</div>
  }
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="viz">
      {items.map((it) => (
        <div className="rank-row" key={it.id}>
          <div className="rank-head">
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
              {it.sub && <span style={{ color: 'var(--color-ink-faint)' }}> · {it.sub}</span>}
            </span>
            <b>{formatValue(it.value)}</b>
          </div>
          <div className="rank-track">
            <div className="rank-fill" style={{ width: `${Math.max((it.value / max) * 100, 1.5)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
