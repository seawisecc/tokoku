'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'

/**
 * Diskon nota yang diberikan kasir dengan tangan.
 *
 * Ini satu-satunya lapis diskon yang angkanya datang dari kasir, dan karena itu
 * satu-satunya yang perlu dijaga. Migrasi 0039 sengaja membuat server
 * mengabaikan `discount_total` kiriman perangkat — alasannya masih berlaku
 * penuh: diskon yang bisa diketik bebas adalah uang yang hilang TANPA
 * meninggalkan selisih kas, karena totalnya ikut mengecil sehingga laci tetap
 * cocok saat tutup shift.
 *
 * Tiga penjagaan, dan ketiganya perlu:
 *  1. **Batas persen ditetapkan pemilik toko** di Pengaturan → Toko, bawaannya
 *     0 (mati). Layar ini tidak muncul sama sekali kalau masih 0.
 *  2. **Server menjepit ulang.** Angka di sini permintaan, bukan keputusan.
 *  3. **Alasan wajib.** Bukan formalitas: tanpa alasan, laporan cuma bisa
 *     bilang "ada diskon Rp 50.000" dan tidak ada yang bisa menindaklanjutinya.
 */
export function ManualDiscount({
  subtotal,
  maxPercent,
  value,
  reason,
  onChange,
}: {
  /** Total belanja sebelum potongan apa pun. */
  subtotal: number
  /** 0 = fitur mati. Dari `organizations.max_manual_discount_percent`. */
  maxPercent: number
  value: number
  reason: string
  onChange: (rupiah: number, alasan: string) => void
}) {
  const [buka, setBuka] = useState(false)

  if (maxPercent <= 0) return null

  const batas = Math.floor((subtotal * maxPercent) / 100)

  if (!buka && value === 0) {
    return (
      <button type="button" className="btn btn-ghost cust-add" onClick={() => setBuka(true)}>
        <Icon name="minus" size={15} />
        Beri diskon (maks {maxPercent}%)
      </button>
    )
  }

  return (
    <div className="redeem-box">
      <div className="redeem-head">
        <Icon name="minus" size={15} />
        <span className="redeem-saldo">
          Diskon maksimal <b>{maxPercent}%</b>
        </span>
        <span className="redeem-rate">sampai {rupiah(batas)}</span>
      </div>

      <div className="redeem-row">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={batas}
          value={value === 0 ? '' : value}
          placeholder="0"
          aria-label={`Potongan rupiah, maksimal ${batas}`}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value) || 0)
            onChange(Math.min(Math.max(n, 0), batas), reason)
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (value === batas) {
              onChange(0, '')
              setBuka(false)
            } else {
              onChange(batas, reason)
            }
          }}
        >
          {value === batas ? 'Batal' : 'Maks'}
        </button>
      </div>

      {/* Alasan diletakkan SESUDAH angkanya, bukan sebelum: kasir memutuskan
          nominalnya dulu sambil bicara dengan pembeli, dan diminta menjelaskan
          setelahnya. Diminta lebih dulu, kotaknya diisi asal supaya cepat. */}
      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
        <input
          value={reason}
          onChange={(e) => onChange(value, e.target.value)}
          placeholder="Alasan, mis. barang penyok / langganan"
          aria-label="Alasan diskon"
        />
        {value > 0 && !reason.trim() && (
          <div className="field-error">Alasan wajib diisi sebelum bisa dibayar.</div>
        )}
      </div>
    </div>
  )
}
