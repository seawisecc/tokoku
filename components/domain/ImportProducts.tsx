'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importProducts, type ImportRow } from '@/app/(toko)/pengaturan/data/actions'
import { Icon } from '@/components/ui/icons'
import { normalkanHeader, parseCsv, toCsv } from '@/lib/csv'
import { cn, rupiah } from '@/lib/format'

/**
 * Nama kolom yang diterima, per kolom yang kita butuhkan.
 *
 * Dicocokkan persis setelah dinormalkan (huruf kecil, spasi tunggal), BUKAN
 * dengan `includes`: "stok" dan "stok minimal" hanya berbeda satu kata, dan
 * pencocokan longgar akan membaca ambang stok menipis sebagai jumlah barang di
 * rak — seluruh gudang tercatat 10 pcs tanpa ada yang menyadarinya.
 */
const KOLOM: Record<keyof Omit<ImportRow, never>, string[]> = {
  sku: ['sku', 'kode', 'kode barang', 'kode produk'],
  name: ['nama', 'name', 'nama barang', 'nama produk', 'produk', 'barang'],
  category: ['kategori', 'category', 'jenis'],
  unit: ['satuan', 'unit'],
  barcode: ['barcode', 'kode barcode', 'ean'],
  sell_price: ['harga jual', 'harga', 'jual', 'sell price', 'harga satuan'],
  cost_price: ['harga beli', 'harga pokok', 'hpp', 'modal', 'beli', 'cost price'],
  min_stock: ['stok minimal', 'minimal stok', 'min stok', 'stok min', 'min stock'],
  stock: ['stok', 'stock', 'jumlah', 'qty', 'kuantitas', 'stok awal'],
}

/**
 * Baca angka rupiah dari sel spreadsheet.
 *
 * Berkasnya datang dari Excel berlokal Indonesia, jadi "Rp 12.500,00" adalah
 * bentuk yang paling sering muncul: titik memisahkan RIBUAN dan koma
 * memisahkan sen. Membuang semua yang bukan digit tanpa membuang bagian sennya
 * dulu akan membaca angka itu sebagai 1.250.000 — harga jual seratus kali
 * lipat, di seluruh daftar, tanpa satu pun pesan error.
 */
function angka(v: string | undefined): number | null {
  if (v === undefined) return null
  const s = v.trim()
  if (!s) return null
  const tanpaSen = s.replace(/,\d{1,2}$/, '')
  const digit = tanpaSen.replace(/[^\d]/g, '')
  if (!digit) return null
  return Number(digit)
}

type Baris = { data: ImportRow; error: string | null; baru: boolean }

const CONTOH = toCsv(
  ['sku', 'nama', 'kategori', 'satuan', 'barcode', 'harga jual', 'harga beli', 'stok', 'stok minimal'],
  [
    ['MNM-0001', 'Aqua 600ml', 'Minuman', 'pcs', '8886008101053', 3500, 2800, 24, 6],
    ['SNK-0001', 'Chitato Sapi Panggang 68g', 'Snack', 'pcs', '', 12000, 9500, 12, 4],
    ['SMB-0001', 'Beras Pandan Wangi 5kg', 'Sembako', 'sak', '', 78000, 68000, 8, 2],
  ],
)

export function ImportProducts({ existingSkus }: { existingSkus: string[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null)
  const [baris, setBaris] = useState<Baris[]>([])
  const [fatal, setFatal] = useState<string | null>(null)
  const [timpa, setTimpa] = useState(true)
  const [hasil, setHasil] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const known = new Set(existingSkus.map((s) => s.toUpperCase()))
  const salah = baris.filter((b) => b.error)
  const siap = baris.filter((b) => !b.error)
  const baru = siap.filter((b) => b.baru).length
  const lama = siap.length - baru

  function reset() {
    setBaris([])
    setNamaBerkas(null)
    setFatal(null)
    setHasil(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function pilihBerkas(file: File) {
    reset()
    setNamaBerkas(file.name)

    const tabel = parseCsv(await file.text())
    if (tabel.length < 2) {
      setFatal('Berkasnya kosong atau cuma berisi baris judul kolom.')
      return
    }

    const header = tabel[0].map(normalkanHeader)
    const idx = (kunci: keyof typeof KOLOM) =>
      header.findIndex((h) => KOLOM[kunci].includes(h))

    const iSku = idx('sku')
    const iNama = idx('name')
    if (iSku < 0 || iNama < 0) {
      // Judul kolom yang benar-benar terbaca ikut disebut. "Kolom SKU tidak
      // ditemukan" saja membuat orang menatap berkas yang menurutnya sudah
      // benar; melihat daftar yang kita baca, ia langsung tahu pemisah
      // kolomnya salah atau ada baris judul nyasar di atas.
      setFatal(
        `Kolom ${iSku < 0 ? '"sku"' : '"nama"'} tidak ketemu. Judul kolom yang terbaca: ` +
          `${header.filter(Boolean).join(', ') || '(kosong)'}.`,
      )
      return
    }

    const iKat = idx('category')
    const iUnit = idx('unit')
    const iBar = idx('barcode')
    const iJual = idx('sell_price')
    const iBeli = idx('cost_price')
    const iMin = idx('min_stock')
    const iStok = idx('stock')

    const terlihat = new Set<string>()
    const hasilBaris: Baris[] = tabel.slice(1).map((r) => {
      const ambil = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
      const sku = ambil(iSku)
      const nama = ambil(iNama)
      const jual = angka(r[iJual])
      const beli = angka(r[iBeli])

      const data: ImportRow = {
        sku,
        name: nama,
        category: ambil(iKat) || null,
        unit: ambil(iUnit) || null,
        barcode: ambil(iBar) || null,
        sell_price: jual ?? 0,
        cost_price: beli ?? 0,
        min_stock: angka(r[iMin]),
        stock: angka(r[iStok]),
      }

      let error: string | null = null
      if (!sku) error = 'Kode barang (SKU) kosong'
      else if (!nama) error = 'Nama barang kosong'
      else if (!/^[A-Za-z0-9._-]+$/.test(sku))
        error = 'SKU hanya boleh huruf, angka, titik, dan strip'
      else if (terlihat.has(sku.toUpperCase()))
        // Dua baris ber-SKU sama di satu berkas hampir selalu berarti barang
        // yang sama tercatat dua kali dengan harga berbeda. Dibiarkan lewat,
        // yang menang adalah baris terakhir — diam-diam, dan hampir pasti
        // bukan yang dimaksud.
        error = 'SKU ini muncul dua kali di berkas yang sama'
      else if (jual === null) error = 'Harga jual kosong atau bukan angka'

      terlihat.add(sku.toUpperCase())
      return { data, error, baru: !known.has(sku.toUpperCase()) }
    })

    if (hasilBaris.length > 2000) {
      setFatal(`Berkasnya berisi ${hasilBaris.length} baris. Sekali impor maksimal 2.000.`)
      return
    }

    setBaris(hasilBaris)
  }

  function unduhContoh() {
    const url = URL.createObjectURL(new Blob([CONTOH], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'contoh-impor-produk.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function simpan() {
    if (siap.length === 0) return
    startTransition(async () => {
      const r = await importProducts(
        siap.map((b) => b.data),
        timpa,
      )
      if (!r.ok) {
        setFatal(r.error)
        return
      }
      setHasil(
        `${r.created} produk baru ditambahkan, ${r.updated} diperbarui` +
          (r.skipped > 0 ? `, ${r.skipped} dilewati` : '') +
          (r.categoriesCreated > 0 ? `, ${r.categoriesCreated} kategori baru dibuat` : '') +
          '.',
      )
      setBaris([])
      setNamaBerkas(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <div className="card">
      <p className="field-hint" style={{ marginTop: 0 }}>
        Berkas CSV dengan kolom <b>sku</b> dan <b>nama</b> (wajib), serta kategori, satuan,
        barcode, harga jual, harga beli, stok, dan stok minimal. Nama kolom boleh ditulis
        bebas huruf besar-kecil. Kolom stok yang dikosongkan berarti stoknya tidak diubah.
      </p>

      <div className="impor-aksi">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          id="berkasImpor"
          className="impor-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void pilihBerkas(f)
          }}
        />
        <label htmlFor="berkasImpor" className="btn btn-dark">
          <Icon name="box" size={15} /> Pilih Berkas CSV
        </label>
        <button type="button" className="btn btn-ghost" onClick={unduhContoh}>
          Unduh Contoh
        </button>
        {namaBerkas && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            Batal
          </button>
        )}
      </div>

      {namaBerkas && (
        <div className="field-hint" style={{ marginTop: 8 }}>
          Berkas: <b>{namaBerkas}</b>
        </div>
      )}

      {fatal && (
        <div className="empty-note" style={{ marginTop: 12 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{fatal}</div>
        </div>
      )}

      {hasil && (
        <div className="empty-note is-ok" style={{ marginTop: 12 }} role="status">
          <Icon name="check" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{hasil}</div>
        </div>
      )}

      {baris.length > 0 && (
        <>
          <div className="section-title">Periksa dulu sebelum disimpan</div>
          <div className="impor-ringkas">
            <span className="badge badge-active">{baru} produk baru</span>
            <span className="badge badge-ok">{lama} SKU sudah ada</span>
            {salah.length > 0 && (
              <span className="badge badge-low">{salah.length} baris bermasalah</span>
            )}
          </div>

          {salah.length > 0 && (
            <div className="empty-note" style={{ marginTop: 12 }} role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                {salah.length} baris akan dilewati karena isinya belum lengkap. Perbaiki di
                spreadsheet lalu pilih berkasnya lagi kalau semuanya harus ikut masuk.
              </div>
            </div>
          )}

          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Harga Jual</th>
                  <th>Stok</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {baris.slice(0, 12).map((b, i) => (
                  <tr key={i} className={cn(b.error && 'row-error')}>
                    <td className="mono">{b.data.sku || '-'}</td>
                    <td>{b.data.name || '-'}</td>
                    <td>{b.data.category ?? '-'}</td>
                    <td>{rupiah(b.data.sell_price)}</td>
                    <td>{b.data.stock ?? '-'}</td>
                    <td>
                      {b.error ? (
                        <span style={{ color: 'var(--color-coral)' }}>{b.error}</span>
                      ) : b.baru ? (
                        'Produk baru'
                      ) : timpa ? (
                        'Diperbarui'
                      ) : (
                        'Dilewati'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {baris.length > 12 && (
            <div className="field-hint" style={{ marginTop: 8 }}>
              Menampilkan 12 baris pertama dari {baris.length}.
            </div>
          )}

          <label className="impor-timpa">
            <input type="checkbox" checked={timpa} onChange={(e) => setTimpa(e.target.checked)} />
            <span>
              Perbarui produk yang SKU-nya sudah ada. Kalau dimatikan, {lama} baris itu
              dilewati dan produk lamanya tidak tersentuh.
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            disabled={pending || siap.length === 0}
            onClick={simpan}
          >
            {pending
              ? 'Menyimpan…'
              : `Impor ${(timpa ? siap.length : baru).toLocaleString('id-ID')} produk`}
          </button>
          {/* Atomik, dan itu harus disebut: pemilik toko yang berkasnya ditolak
              di baris ke-180 perlu tahu ia boleh memperbaiki lalu mengulang
              seluruh berkas, bukan menebak sampai baris berapa yang masuk. */}
          <div className="field-hint" style={{ marginTop: 8 }}>
            Impor dikerjakan sekaligus. Kalau ada yang gagal di tengah, tidak ada satu pun
            baris yang tersimpan dan berkasnya boleh diulang apa adanya.
          </div>
        </>
      )}
    </div>
  )
}
