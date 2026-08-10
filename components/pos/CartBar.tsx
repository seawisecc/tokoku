'use client'

import { Icon } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'

/**
 * Bar keranjang melayang — hanya di layar sempit (< 900px).
 *
 * Di layar lebar keranjang berdiri sebagai kolom kanan yang lengket, jadi
 * tombol Bayar selalu terlihat. Di ponsel keranjang jatuh ke BAWAH daftar
 * produk: dengan katalog seratusan barang, kasir harus menggulir melewati
 * seluruh katalog untuk menyelesaikan satu transaksi. Bar ini memotong jalan
 * itu — total dan tombol Bayar menempel di layar begitu keranjang terisi.
 *
 * Sisi kiri sengaja tetap mengarah ke keranjang: mengubah jumlah dan membuang
 * baris tetap dilakukan di panel keranjang, bar ini tidak menggandakannya.
 */
export function CartBar({
  count,
  total,
  ready,
  notReadyLabel = 'Menyiapkan…',
  onReview,
  onPay,
}: {
  /** Jumlah barang (bukan jumlah baris) di keranjang. */
  count: number
  total: number
  /** false selama perangkat POS belum terdaftar. */
  ready: boolean
  /** Bunyi tombol saat belum siap — harus jujur soal penyebabnya. */
  notReadyLabel?: string
  onReview: () => void
  onPay: () => void
}) {
  if (count === 0) return null

  return (
    <div className="cart-bar">
      <button type="button" className="cart-bar-info" onClick={onReview}>
        <span className="cart-bar-count">
          <Icon name="cart" size={15} />
          {count}
        </span>
        <span className="cart-bar-total">{rupiah(total)}</span>
        <span className="cart-bar-hint">Lihat keranjang</span>
      </button>
      <button type="button" className="btn btn-primary" disabled={!ready} onClick={onPay}>
        {ready ? 'Bayar' : notReadyLabel}
      </button>
    </div>
  )
}
