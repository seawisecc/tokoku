import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportProducts } from '@/components/domain/ImportProducts'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Impor & Backup Data | TokoKu' }
export const dynamic = 'force-dynamic'

/** Satu tombol unduh. Dipakai berulang supaya bentuknya tidak bergeser. */
function Unduh({
  jenis,
  hari,
  judul,
  jelas,
  jumlah,
}: {
  jenis: string
  hari?: number
  judul: string
  jelas: string
  jumlah: string
}) {
  return (
    <a
      className="unduh-kartu"
      href={`/pengaturan/data/ekspor?jenis=${jenis}${hari ? `&hari=${hari}` : ''}`}
      // Tautan biasa, bukan tombol ber-JavaScript: yang dikirim server adalah
      // berkas, dan browser sudah tahu cara menyimpannya. Blob di sisi klien
      // berarti seluruh riwayat harus muat di memori ponsel dulu.
      download
    >
      <div className="unduh-ikon">
        <Icon name="layers" size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Jumlah baris duduk SEBARIS dengan judulnya, bukan di ujung kanan
            kartu. Ditaruh di kanan, ia memakan lebar dari keterangan sehingga
            kalimat sependek "Satu baris per barang di tiap nota" pecah jadi
            lima baris dan tinggi kartunya jadi berbeda-beda. */}
        <div className="unduh-judul">
          <span className="cell-name">{judul}</span>
          <span className="badge badge-ok">{jumlah}</span>
        </div>
        <div className="cell-sub">{jelas}</div>
      </div>
    </a>
  )
}

export default async function DataPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()
  const orgId = session.org!.id

  const [{ data: skus }, produk, pelanggan, transaksi] = await Promise.all([
    supabase.from('products').select('sku').eq('organization_id', orgId).is('deleted_at', null),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ])

  const n = (v: number | null) => (v ?? 0).toLocaleString('id-ID')

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Impor & Backup Data"
        subtitle="Masukkan daftar barang dari berkas CSV, dan simpan salinan data toko kapan saja."
      />

      <div className="section-title" style={{ marginTop: 0 }}>
        Simpan Salinan (Backup)
      </div>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Berkas CSV bisa dibuka di Excel, Google Sheets, maupun Numbers. Simpan di tempat yang
        bukan perangkat ini juga, misalnya Google Drive.
      </p>
      <div className="unduh-grid">
        <Unduh
          jenis="produk"
          judul="Daftar Produk"
          jelas="Kolomnya sama persis dengan berkas impor, jadi bisa dimasukkan kembali."
          jumlah={`${n(produk.count)} produk`}
        />
        <Unduh
          jenis="pelanggan"
          judul="Daftar Pelanggan"
          jelas="Nama, nomor HP, total belanja, kunjungan, dan saldo poin."
          jumlah={`${n(pelanggan.count)} pelanggan`}
        />
        <Unduh
          jenis="transaksi"
          hari={3650}
          judul="Riwayat Transaksi"
          jelas="Satu baris per nota: total, modal, laba kotor, kasir, dan cabangnya."
          jumlah={`${n(transaksi.count)} transaksi`}
        />
        <Unduh
          jenis="item"
          hari={3650}
          judul="Rincian Barang Terjual"
          jelas="Satu baris per barang di tiap nota. Untuk menghitung sendiri di spreadsheet."
          jumlah="semua waktu"
        />
      </div>

      <div className="section-title">Impor Produk dari CSV</div>
      <ImportProducts existingSkus={(skus ?? []).map((p) => p.sku)} />

      {/* Impor pelanggan dan transaksi sengaja TIDAK disediakan, dan alasannya
          berbeda untuk masing-masing — jadi keduanya disebut, bukan
          didiamkan. Fitur yang hilang tanpa penjelasan terbaca sebagai
          aplikasi yang belum jadi. */}
      <p className="field-hint" style={{ marginTop: 14 }}>
        Yang bisa diimpor baru daftar produk. Riwayat transaksi tidak bisa dimasukkan dari luar:
        nomor nota, stok, dan poin pelanggan semuanya lahir dari transaksi yang benar-benar
        terjadi, jadi memasukkannya dari berkas akan membuat pembukuan yang tidak bisa
        dipertanggungjawabkan. Untuk daftar pelanggan, hubungi kami lewat WhatsApp di halaman
        Langganan.
      </p>
    </>
  )
}
