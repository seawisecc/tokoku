import { rupiah } from '@/lib/format'

export type ReceiptData = {
  code: string
  storeName: string
  /**
   * Logo toko. Sudah disaring sakelar "Tampilkan logo" oleh pemanggilnya —
   * di sini null berarti "jangan cetak", tanpa perlu tahu sebabnya mati atau
   * memang belum pernah diunggah.
   */
  logoUrl?: string | null
  storeAddress?: string | null
  storePhone?: string | null
  outletName?: string | null
  cashierName: string
  at: string
  paymentMethod: 'cash' | 'qris' | string
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[]
  subtotal: number
  discount?: number
  /**
   * Sebutan potongannya. Bawaannya "Diskon", tapi potongan poin harus menyebut
   * jumlah poin yang terpakai — pembeli menyimpan struk ini justru untuk
   * memeriksa poinnya, dan angka tanpa keterangan tidak bisa dicocokkan dengan
   * saldo yang tersisa.
   */
  discountLabel?: string
  tax?: number
  total: number
  paid: number
  change: number
  footer?: string | null
  offline?: boolean
  /** Transaksi dibatalkan — struknya HARUS mengatakan itu. Lihat catatan di bawah. */
  voided?: boolean
}

const METHOD: Record<string, string> = {
  cash: 'TUNAI',
  qris: 'QRIS',
  transfer: 'TRANSFER',
  card: 'KARTU',
  other: 'LAINNYA',
}

/**
 * Struk thermal 58mm.
 *
 * Lebarnya dikunci 48mm (58mm dikurangi margin cetak umum) dan seluruhnya
 * monospace, karena printer thermal murah menyelaraskan kolom berdasarkan
 * jumlah karakter, bukan lebar piksel. Font proporsional akan membuat kolom
 * harga bergeser-geser.
 */
export function Receipt({ data }: { data: ReceiptData }) {
  const waktu = new Date(data.at).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="receipt">
      {/* Penanda pembatalan ditaruh PALING ATAS, sebelum nama toko.
          Tanpa ini, struk transaksi yang sudah dibatalkan tercetak persis
          seperti struk sah — pembeli memegang bukti pembayaran atas transaksi
          yang uangnya sudah dikembalikan, dan tidak ada apa pun di kertas itu
          yang membantah. Di atas, bukan di bawah: struk thermal sering disobek
          sebelum habis. */}
      {data.voided && (
        <>
          <div className="r-center r-bold">*** TRANSAKSI DIBATALKAN ***</div>
          <div className="r-center r-dim">Struk ini bukan bukti pembayaran</div>
          <div className="r-rule" />
        </>
      )}
      {/* Logo di ATAS nama toko, mengikuti kebiasaan struk warung. Dibatasi
          tingginya supaya logo persegi panjang tidak mendorong seluruh isi
          struk turun — kertas thermal dibayar per sentimeter. */}
      {data.logoUrl && (
        <div className="r-center r-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- dokumen cetak,
              bukan halaman; next/image menyisipkan wrapper yang mengacaukan
              lebar 48mm yang dikunci. */}
          <img src={data.logoUrl} alt="" />
        </div>
      )}
      <div className="r-center r-bold">{data.storeName}</div>
      {/* Outlet utama sering bernama sama dengan tokonya; jangan cetak dua kali. */}
      {data.outletName && data.outletName !== data.storeName && (
        <div className="r-center r-dim">{data.outletName}</div>
      )}
      {data.storeAddress && <div className="r-center r-dim">{data.storeAddress}</div>}
      {data.storePhone && <div className="r-center r-dim">{data.storePhone}</div>}

      <div className="r-rule" />

      <div className="r-row">
        <span>{data.code}</span>
      </div>
      <div className="r-row r-dim">
        <span>{waktu}</span>
      </div>
      <div className="r-row r-dim">
        <span>Kasir: {data.cashierName}</span>
      </div>

      <div className="r-rule" />

      {data.items.map((it, i) => (
        <div key={i} className="r-item">
          <div>{it.name}</div>
          <div className="r-row">
            <span className="r-dim">
              {it.qty} x {rupiah(it.unitPrice)}
            </span>
            <span>{rupiah(it.lineTotal)}</span>
          </div>
        </div>
      ))}

      <div className="r-rule" />

      <div className="r-row">
        <span>Subtotal</span>
        <span>{rupiah(data.subtotal)}</span>
      </div>
      {!!data.discount && (
        <div className="r-row">
          <span>{data.discountLabel || 'Diskon'}</span>
          <span>-{rupiah(data.discount)}</span>
        </div>
      )}
      {!!data.tax && (
        <div className="r-row">
          <span>Pajak</span>
          <span>{rupiah(data.tax)}</span>
        </div>
      )}
      <div className="r-row r-bold r-total">
        <span>TOTAL</span>
        <span>{rupiah(data.total)}</span>
      </div>
      <div className="r-row">
        <span>{METHOD[data.paymentMethod] ?? data.paymentMethod}</span>
        <span>{rupiah(data.paid)}</span>
      </div>
      {data.paymentMethod === 'cash' && (
        <div className="r-row">
          <span>Kembali</span>
          <span>{rupiah(data.change)}</span>
        </div>
      )}

      <div className="r-rule" />

      {data.offline && (
        <div className="r-center r-dim">* dibuat saat perangkat offline *</div>
      )}
      <div className="r-center">{data.footer || 'Terima kasih telah berbelanja'}</div>
      <div className="r-center r-dim r-brand">TokoKu by Seawise Studio</div>
    </div>
  )
}
