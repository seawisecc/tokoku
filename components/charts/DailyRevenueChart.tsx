'use client'

import { useState } from 'react'
import { rupiah, rupiahShort } from '@/lib/format'

export type DailyPoint = { date: string; label: string; revenue: number; count: number }

const PLOT_H = 200

/**
 * Omset per hari — batang, satu seri.
 *
 * Dibangun dari elemen HTML biasa, bukan SVG ber-viewBox: viewBox menskalakan
 * seluruh gambar mengikuti lebar container, sehingga di layar lebar grafiknya
 * ikut menjulang tinggi dan sudut membulatnya menjadi lonjong. Dengan tinggi
 * tetap dan lebar fleksibel, proporsinya benar di semua ukuran layar.
 *
 * Satu seri berarti TIDAK ada legenda — judul kartunya sudah menyebut apa yang
 * diukur. Nilai hanya ditulis pada hari tertinggi; sisanya lewat hover, karena
 * angka di setiap batang membuat grafik tak terbaca.
 */
export function DailyRevenueChart({ data }: { data: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div className="placeholder-card" style={{ border: 'none' }}>
        Belum ada penjualan pada periode ini.
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.revenue), 1)
  const peakIndex = data.reduce((best, d, i) => (d.revenue > data[best].revenue ? i : best), 0)
  const labelEvery = data.length > 20 ? 5 : data.length > 10 ? 2 : 1

  return (
    <div className="viz" style={{ position: 'relative' }}>
      <div style={{ position: 'relative', height: PLOT_H, marginTop: 18 }}>
        {/* garis bantu, sengaja resesif */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <div
            key={g}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${g * 100}%`,
              borderTop: '1px solid var(--viz-grid)',
            }}
          />
        ))}

        <div
          role="img"
          aria-label={`Omset harian ${data.length} hari. Tertinggi ${data[peakIndex].label} sebesar ${rupiah(data[peakIndex].revenue)}.`}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          {data.map((d, i) => {
            const pct = (d.revenue / max) * 100
            return (
              <div
                key={d.date}
                className="viz-col"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'default',
                }}
              >
                {i === peakIndex && d.revenue > 0 && (
                  <div
                    className="viz-value-label"
                    style={{
                      position: 'absolute',
                      bottom: `calc(${pct}% + 6px)`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rupiahShort(d.revenue)}
                  </div>
                )}
                <div
                  className="viz-bar"
                  style={{
                    width: '100%',
                    maxWidth: 28,
                    height: d.revenue > 0 ? `max(${pct}%, 3px)` : 0,
                    background: 'var(--series-1)',
                    borderRadius: '4px 4px 0 0',
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={d.date} className="viz-axis-label" style={{ flex: 1, textAlign: 'center' }}>
            {i % labelEvery === 0 || i === data.length - 1 ? d.label : ''}
          </div>
        ))}
      </div>

      {hover !== null && (() => {
        // Jepit ke tepi: batang paling kanan adalah HARI INI — batang yang
        // paling sering dilihat — dan tooltip di tengah akan terpotong kartu.
        const pos = (hover + 0.5) / data.length
        const anchor = pos > 0.85 ? 'translate(-100%, -100%)' : pos < 0.15 ? 'translate(0, -100%)' : 'translate(-50%, -100%)'
        return (
        <div
          className="viz-tooltip"
          style={{
            left: `${pos * 100}%`,
            top: 12 + (PLOT_H - (data[hover].revenue / max) * PLOT_H),
            transform: anchor,
          }}
        >
          <b>{rupiah(data[hover].revenue)}</b>
          {data[hover].label} · {data[hover].count} transaksi
        </div>
        )
      })()}
    </div>
  )
}
