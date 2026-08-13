/**
 * Gambar struk sebagai PNG, untuk dikirim lewat WhatsApp.
 *
 * Digambar sendiri ke canvas, bukan memotret DOM dengan pustaka semacam
 * html2canvas: yang dibutuhkan cuma teks monospace di atas latar putih, dan
 * satu dependensi 200 KB untuk itu tidak sepadan di aplikasi yang dipakai
 * kasir lewat jaringan warung.
 *
 * Lebarnya 384 piksel karena itu jumlah titik satu baris pada printer thermal
 * 58mm (203 dpi). Ukuran yang sama membuat gambar ini terbaca wajar di layar
 * HP dan tetap masuk akal kalau nanti ada yang mencetaknya.
 */
export type ReceiptImageData = {
  storeName: string
  storeAddress?: string | null
  storePhone?: string | null
  outletName?: string | null
  code: string
  at: string
  cashierName: string
  items: {
    name: string
    qty: number
    unitPrice: number
    lineTotal: number
    normalPrice?: number
  }[]
  subtotal: number
  discount?: number
  /** Sebutan potongan; "Tukar 50 poin" untuk penukaran loyalty. */
  discountLabel?: string
  total: number
  paid: number
  change: number
  paymentMethod: string
  footer?: string | null
}

const W = 384
const PAD = 16
const BARIS = 22 // tinggi satu baris teks
const METODE: Record<string, string> = {
  cash: 'TUNAI',
  qris: 'QRIS',
  transfer: 'TRANSFER',
  card: 'KARTU',
}

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

export async function buatGambarStruk(d: ReceiptImageData): Promise<Blob> {
  /**
   * Tingginya ditaksir BERLEBIH dulu, lalu dipotong sesuai isi sebenarnya.
   *
   * Kanvas tidak bisa ditinggikan setelah digambar tanpa menghapus isinya, jadi
   * taksirannya harus aman. Menghitung tepat di depan berarti aturan tinggi
   * ditulis dua kali — sekali untuk menghitung, sekali saat menggambar — dan
   * begitu ada baris baru ditambahkan tanpa memperbarui hitungannya, struknya
   * terpotong diam-diam di bawah. Dipotong belakangan, hitungannya cuma perlu
   * "cukup", bukan "persis".
   */
  let baris = 6 // nama toko + jarak (dilebihkan; kelebihannya dipotong nanti)
  if (d.storeAddress) baris += 1
  if (d.storePhone) baris += 1
  if (d.outletName && d.outletName !== d.storeName) baris += 1
  baris += 3 // kode, waktu, kasir
  baris += 1 // garis
  // Tiap barang dua baris, plus satu lagi kalau sedang promo. Taksirannya
  // boleh berlebih — kelebihannya dipotong di akhir — tapi TIDAK BOLEH kurang.
  baris += d.items.length * 2 + d.items.filter((i) => i.normalPrice).length
  baris += 1 // garis
  if (d.discount && d.discount > 0) baris += 1
  baris += 4 // subtotal, total, bayar, kembali
  if (d.footer) baris += 2
  baris += 2 // brand

  const H = PAD * 2 + baris * BARIS
  const dpr = 2 // supaya tidak buram di layar HP ber-DPI tinggi
  const cv = document.createElement('canvas')
  cv.width = W * dpr
  cv.height = H * dpr
  const g = cv.getContext('2d')
  if (!g) throw new Error('Canvas tidak tersedia di perangkat ini.')
  g.scale(dpr, dpr)

  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#000000'
  g.textBaseline = 'top'

  let y = PAD
  const mono = (size: number, bold = false) =>
    `${bold ? 'bold ' : ''}${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`

  const tengah = (teks: string, size = 13, bold = false) => {
    g.font = mono(size, bold)
    g.fillText(teks, (W - g.measureText(teks).width) / 2, y)
    y += BARIS
  }
  const kiri = (teks: string, size = 12) => {
    g.font = mono(size)
    g.fillText(teks, PAD, y)
    y += BARIS
  }
  const duaKolom = (kiriTeks: string, kananTeks: string, size = 12, bold = false) => {
    g.font = mono(size, bold)
    g.fillText(kiriTeks, PAD, y)
    g.fillText(kananTeks, W - PAD - g.measureText(kananTeks).width, y)
    y += BARIS
  }
  const garis = () => {
    g.strokeStyle = '#000000'
    g.setLineDash([3, 3])
    g.beginPath()
    g.moveTo(PAD, y + 8)
    g.lineTo(W - PAD, y + 8)
    g.stroke()
    g.setLineDash([])
    y += BARIS
  }

  tengah(d.storeName, 15, true)
  if (d.outletName && d.outletName !== d.storeName) tengah(d.outletName, 11)
  if (d.storeAddress) tengah(d.storeAddress, 11)
  if (d.storePhone) tengah(d.storePhone, 11)
  y += 4
  garis()

  kiri(d.code)
  kiri(
    new Date(d.at).toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )
  kiri(`Kasir: ${d.cashierName}`)
  garis()

  for (const it of d.items) {
    // Nama panjang dipotong, bukan dibungkus: pembungkusan membuat tinggi
    // kanvas yang sudah dihitung meleset dan strukya terpotong di bawah.
    const nama = it.name.length > 30 ? it.name.slice(0, 29) + '…' : it.name
    kiri(nama, 12)
    duaKolom(`  ${it.qty} x ${rp(it.unitPrice)}`, rp(it.lineTotal), 11)
    if (it.normalPrice && it.normalPrice > it.unitPrice) {
      kiri(`  promo, normal ${rp(it.normalPrice)}`, 10)
    }
  }
  garis()

  duaKolom('Subtotal', rp(d.subtotal))
  if (d.discount && d.discount > 0) duaKolom(d.discountLabel || 'Diskon', '-' + rp(d.discount))
  duaKolom('TOTAL', rp(d.total), 15, true)
  duaKolom(METODE[d.paymentMethod] ?? d.paymentMethod.toUpperCase(), rp(d.paid))
  duaKolom('Kembali', rp(d.change))

  if (d.footer) {
    y += 6
    tengah(d.footer, 11)
  }
  y += 4
  tengah('TokoKu by Seawise Studio', 10)

  // Potong ke tinggi yang benar-benar terpakai. Tanpa ini strukya berakhir
  // dengan bidang putih kosong yang di chat WhatsApp terbaca seperti gambar
  // yang gagal dimuat sebagian.
  const tinggiTerpakai = Math.ceil(y + PAD)
  const potong = document.createElement('canvas')
  potong.width = W * dpr
  potong.height = tinggiTerpakai * dpr
  const gp = potong.getContext('2d')
  if (!gp) throw new Error('Canvas tidak tersedia di perangkat ini.')
  gp.drawImage(cv, 0, 0, W * dpr, tinggiTerpakai * dpr, 0, 0, W * dpr, tinggiTerpakai * dpr)

  return new Promise<Blob>((resolve, reject) =>
    potong.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gambar struk gagal dibuat.'))),
      'image/png',
    ),
  )
}

/**
 * Bagikan gambar lewat share sheet perangkat.
 *
 * Di HP, share sheet memuat WhatsApp dan gambarnya benar-benar TERLAMPIR —
 * satu-satunya cara melampirkan berkas ke WhatsApp dari web, karena tautan
 * `wa.me` hanya bisa mengisi teks.
 *
 * Mengembalikan 'shared' | 'downloaded' | 'cancelled' supaya pemanggil bisa
 * mengatakan apa yang sebenarnya terjadi, bukan menebak.
 */
export async function bagikanGambar(
  blob: Blob,
  namaBerkas: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], namaBerkas, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      // Menutup share sheet melempar AbortError. Itu bukan kegagalan, dan tidak
      // boleh dilaporkan sebagai error ke kasir.
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
      // Selain itu jatuh ke unduh di bawah.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaBerkas
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
