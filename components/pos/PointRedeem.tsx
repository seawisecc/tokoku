'use client'

import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'

/**
 * Tukar poin saat membayar.
 *
 * Sampai hari ini poin hanya bisa BERTAMBAH: aturannya sudah jalan penuh di
 * database sejak migrasi 0037, tapi kasir tidak punya satu pun tombol untuk
 * memakainya. Bagi pembeli, program poin yang tidak pernah bisa ditukar sama
 * saja dengan tidak ada.
 *
 * Dua batas dipakai bersamaan, dan keduanya perlu:
 *  - **saldo pembeli** — jelas.
 *  - **nota ini** — poin tidak boleh membuat total jadi minus, dan toko tidak
 *    mengembalikan kelebihannya sebagai uang tunai. Tanpa batas kedua, kasir
 *    memasukkan seluruh saldo pada belanja Rp 5.000 lalu poin senilai puluhan
 *    ribu habis begitu saja.
 *
 * Angkanya dijepit di sini DAN di server (migrasi 0039). Yang di sini supaya
 * kasir melihat batasnya sebelum menyebutkan angka ke pembeli; yang di server
 * karena jalur uang tidak boleh bergantung pada satu penjagaan saja.
 */
export function PointRedeem({
  customerName,
  saldo,
  pointValue,
  maxRupiah,
  value,
  onChange,
}: {
  customerName: string
  /** Saldo poin pembeli saat dipilih. */
  saldo: number
  /** Rupiah yang diwakili 1 poin. */
  pointValue: number
  /** Sisa tagihan yang masih bisa dipotong (sudah dikurangi potongan lain). */
  maxRupiah: number
  value: number
  onChange: (poin: number) => void
}) {
  // Berapa poin yang MUAT di nota ini. Pembulatan ke bawah: setengah poin
  // tidak ada, dan membulatkan ke atas berarti memberi potongan melebihi
  // tagihannya.
  const muat = pointValue > 0 ? Math.floor(maxRupiah / pointValue) : 0
  const maks = Math.max(Math.min(saldo, muat), 0)
  const potongan = value * pointValue

  if (saldo <= 0) {
    return (
      <div className="redeem-box redeem-empty">
        <Icon name="star" size={15} />
        <span>{customerName} belum punya poin yang bisa ditukar.</span>
      </div>
    )
  }

  return (
    <div className="redeem-box">
      <div className="redeem-head">
        <Icon name="star" size={15} />
        <span className="redeem-saldo">
          <b>{saldo.toLocaleString('id-ID')} poin</b> tersedia
        </span>
        <span className="redeem-rate">senilai {rupiah(saldo * pointValue)}</span>
      </div>

      {maks === 0 ? (
        <div className="field-hint" style={{ marginTop: 6 }}>
          Belanja ini belum cukup untuk menukar 1 poin. Satu poin bernilai{' '}
          {rupiah(pointValue)}.
        </div>
      ) : (
        <>
          <div className="redeem-row">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={maks}
              value={value === 0 ? '' : value}
              placeholder="0"
              aria-label={`Poin yang ditukar, maksimal ${maks}`}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value) || 0)
                onChange(Math.min(Math.max(n, 0), maks))
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(value === maks ? 0 : maks)}
            >
              {value === maks ? 'Batal tukar' : `Tukar ${maks.toLocaleString('id-ID')}`}
            </button>
          </div>

          <div className="field-hint" style={{ marginTop: 6 }}>
            {potongan > 0 ? (
              <>
                Potongan {rupiah(potongan)}. Sisa poin setelah ini{' '}
                {(saldo - value).toLocaleString('id-ID')}.
              </>
            ) : (
              <>
                Maksimal {maks.toLocaleString('id-ID')} poin untuk nota ini
                {maks < saldo ? ' (dibatasi total belanja)' : ''}. 1 poin ={' '}
                {rupiah(pointValue)}.
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
