import { Fragment } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import { createPublicClient } from '@/lib/supabase/public'

const DESKRIPSI =
  'Kasir offline, pindai barcode, stok bercabang, pembelian, konsinyasi, pelanggan & poin. Mulai Rp 99.000/bulan, gratis 14 hari.'

export const metadata: Metadata = {
  title: 'Fitur & Harga | TokoKu',
  description: DESKRIPSI,
  openGraph: {
    title: 'TokoKu: fitur lengkap & harga',
    description: DESKRIPSI,
    url: '/fitur',
  },
  twitter: { card: 'summary_large_image', title: 'TokoKu: fitur lengkap & harga', description: DESKRIPSI },
}

/**
 * Halaman publik: fitur lengkap + harga.
 *
 * Harga TIDAK ditulis di kode. Dibaca dari tabel `plans` yang juga dipakai
 * menegakkan kuota, jadi angka yang dilihat calon klien selalu sama dengan yang
 * ditagihkan. Harga yang disalin ke halaman marketing adalah harga yang cepat
 * atau lambat berbeda dari kenyataan.
 *
 * `plans_read_public` (migrasi 0013) memang mengizinkan pembacaan tanpa login.
 */
export const revalidate = 300

type Fitur = { icon: IconName; judul: string; isi: string }

const INTI: Fitur[] = [
  {
    icon: 'cart',
    judul: 'Kasir yang tidak ikut mati',
    isi: 'Transaksi tersimpan di perangkat lebih dulu, baru dikirim saat sinyal kembali. Nomor struk tetap runut, stok tetap terpotong, dan tidak ada penjualan yang hilang.',
  },
  {
    icon: 'scan',
    judul: 'Pindai barcode',
    isi: 'Pakai kamera HP atau alat pemindai biasa. Arahkan ke kemasan, barangnya langsung masuk keranjang.',
  },
  {
    icon: 'box',
    judul: 'Stok yang bisa dipercaya',
    isi: 'Setiap perubahan stok punya jejak: penjualan, pembelian, opname, transfer. Kartu stok menunjukkan saldo berjalan per produk, dan barisnya tidak bisa dihapus siapa pun.',
  },
  {
    icon: 'chart',
    judul: 'Laporan yang jujur',
    isi: 'Omset, laba kotor, produk terlaris, metode bayar, dan selisih kas per shift. Dihitung dari jam mesin kasir, bukan jam server, supaya penjualan offline jatuh di tanggal yang benar.',
  },
]

const LAINNYA: Fitur[] = [
  {
    icon: 'store',
    judul: 'Banyak cabang',
    isi: 'Stok, kasir, dan struk berdiri sendiri per cabang. Laporan bisa digabung atau dibandingkan antar cabang, dan barang bisa dipindahkan dengan jejak dua sisi.',
  },
  {
    icon: 'layers',
    judul: 'Pembelian & konsinyasi',
    isi: 'Catat barang masuk, harga pokok ikut diperbarui. Barang titipan dihitung terpisah: hutang lahir hanya sebesar yang benar-benar terjual.',
  },
  {
    icon: 'users',
    judul: 'Pelanggan & poin',
    isi: 'Catat pembeli langganan, kumpulkan poin otomatis, dan lihat siapa yang sering datang atau sudah lama tidak kelihatan.',
  },
  {
    icon: 'whatsapp',
    judul: 'Nota lewat WhatsApp',
    isi: 'Kirim struk sebagai gambar atau teks langsung ke WhatsApp pembeli. Tanpa biaya tambahan dan tanpa penyedia pihak ketiga.',
  },
  {
    icon: 'printer',
    judul: 'Struk thermal 58mm',
    isi: 'Cetak ke printer thermal biasa, lengkap dengan logo toko. Transaksi yang dibatalkan tercetak dengan penandanya sendiri.',
  },
  {
    icon: 'sliders',
    judul: 'Tim & hak akses',
    isi: 'Kasir, admin, dan pemilik punya batas masing-masing. Izin ditegakkan di database, bukan cuma disembunyikan dari layar.',
  },
]

/**
 * Kemampuan satu paket, dibaca dari baris `plans` yang sama dengan yang dipakai
 * menegakkan kuota. Jangan menulisnya tangan per kode paket: halaman jualan yang
 * menjanjikan sesuatu yang tidak ditegakkan database adalah janji yang batal di
 * hari pertama klien mencobanya.
 */
type PlanRow = {
  code: string
  name: string
  description: string | null
  price_monthly: number
  max_outlets: number | null
  max_users: number | null
  max_products: number | null
  max_devices: number | null
  features: unknown
}

function kemampuan(p: PlanRow) {
  const f = (p.features ?? {}) as Record<string, unknown>
  const tingkat = (v: unknown) => (v === 'basic' ? 'basic' : 'full') as 'basic' | 'full'
  return {
    reports: tingkat(f.reports),
    purchasing: tingkat(f.purchasing),
    crm: tingkat(f.crm),
    /**
     * Cabang dibaca dari KUOTA, bukan dari penanda `multi_outlet`.
     *
     * Keduanya bisa berbeda pendapat: penanda bilang "boleh" sementara
     * `max_outlets` bilang "penuh", dan yang benar-benar menolak saat tombol
     * ditekan adalah kuotanya. Aturan yang sama dipakai di dalam aplikasi.
     */
    cabang: p.max_outlets === null || p.max_outlets > 1,
    api: f.api === true,
    /** Ringkas, untuk sel tabel. */
    dukungan:
      f.support === 'dedicated'
        ? 'Pendampingan khusus'
        : f.support === 'whatsapp'
          ? 'WhatsApp'
          : 'Email',
    /** Kalimat utuh, untuk daftar di kartu paket. Ditulis terpisah karena
        "Bantuan lewat pendampingan khusus" tidak bisa dibentuk dari yang di atas. */
    dukunganKartu:
      f.support === 'dedicated'
        ? 'Pendampingan khusus'
        : f.support === 'whatsapp'
          ? 'Bantuan lewat WhatsApp'
          : 'Bantuan lewat email',
  }
}

/** Baris tabel perbandingan. `true` tercetak centang, `false` tanda minus. */
type BarisBanding = {
  label: string
  nilai: (p: PlanRow) => string | boolean
}

const KELOMPOK: { judul: string; baris: BarisBanding[] }[] = [
  {
    judul: 'Kasir & penjualan',
    baris: [
      { label: 'Kasir offline, tersinkron otomatis', nilai: () => true },
      { label: 'Pindai barcode (kamera & alat pemindai)', nilai: () => true },
      { label: 'Struk thermal 58mm + logo toko', nilai: () => true },
      { label: 'Buka & tutup shift, selisih kas', nilai: () => true },
      { label: 'Kirim nota ke WhatsApp pembeli', nilai: () => true },
    ],
  },
  {
    judul: 'Produk & stok',
    baris: [
      { label: 'Produk, kategori, kartu stok', nilai: () => true },
      { label: 'Opname & penyesuaian stok bercatat', nilai: () => true },
      { label: 'Peringatan stok menipis per produk', nilai: () => true },
      { label: 'Transfer stok antar cabang', nilai: (p) => kemampuan(p).cabang },
    ],
  },
  {
    judul: 'Pembelian',
    baris: [
      { label: 'Catat barang masuk, harga pokok ikut diperbarui', nilai: () => true },
      { label: 'Pemasok & riwayat pembelian', nilai: (p) => kemampuan(p).purchasing === 'full' },
      { label: 'Tempo, hutang, pengingat jatuh tempo', nilai: (p) => kemampuan(p).purchasing === 'full' },
      { label: 'Konsinyasi: titip jual, bagi hasil, retur', nilai: (p) => kemampuan(p).purchasing === 'full' },
    ],
  },
  {
    judul: 'Laporan',
    baris: [
      { label: 'Omset, jumlah transaksi, rata-rata, grafik harian', nilai: () => true },
      { label: 'Laporan shift & selisih kas', nilai: () => true },
      { label: 'Rentang waktu', nilai: (p) => (kemampuan(p).reports === 'full' ? '90 hari' : '30 hari') },
      { label: 'Laba kotor & margin', nilai: (p) => kemampuan(p).reports === 'full' },
      { label: 'Produk terlaris & metode bayar', nilai: (p) => kemampuan(p).reports === 'full' },
      { label: 'Perbandingan antar cabang', nilai: (p) => kemampuan(p).reports === 'full' && kemampuan(p).cabang },
    ],
  },
  {
    judul: 'Pelanggan',
    baris: [
      { label: 'Catat pelanggan saat transaksi', nilai: () => true },
      { label: 'Daftar & pencarian pelanggan', nilai: () => true },
      { label: 'Poin loyalty otomatis', nilai: (p) => kemampuan(p).crm === 'full' },
      { label: 'Total belanja & kunjungan per pelanggan', nilai: (p) => kemampuan(p).crm === 'full' },
      { label: 'Segmentasi pelanggan', nilai: (p) => kemampuan(p).crm === 'full' },
    ],
  },
  {
    judul: 'Batas pemakaian',
    baris: [
      { label: 'Outlet / cabang', nilai: (p) => (p.max_outlets === null ? 'Tanpa batas' : `${p.max_outlets}`) },
      { label: 'Pengguna', nilai: (p) => (p.max_users === null ? 'Tanpa batas' : `${p.max_users}`) },
      { label: 'Produk', nilai: (p) => (p.max_products === null ? 'Tanpa batas' : p.max_products.toLocaleString('id-ID')) },
      { label: 'Perangkat kasir', nilai: (p) => (p.max_devices === null ? 'Tanpa batas' : `${p.max_devices}`) },
      { label: 'Toko dalam satu akun', nilai: () => 'Sampai 5' },
    ],
  },
  {
    judul: 'Dukungan',
    baris: [
      { label: 'Bantuan', nilai: (p) => kemampuan(p).dukungan },
      { label: 'Akses API', nilai: (p) => kemampuan(p).api },
    ],
  },
]

/** Yang ditonjolkan di kartu paket: pembeda, bukan pengulangan yang dasar. */
function sorotan(p: PlanRow): string[] {
  const k = kemampuan(p)
  const out: string[] = []

  out.push(p.max_outlets === null ? 'Cabang tanpa batas' : p.max_outlets === 1 ? '1 outlet' : `Sampai ${p.max_outlets} cabang`)
  out.push(
    p.max_products === null
      ? 'Produk tanpa batas'
      : `${p.max_products.toLocaleString('id-ID')} produk`,
  )
  out.push(
    p.max_users === null ? 'Pengguna tanpa batas' : `${p.max_users} pengguna`,
  )
  out.push(
    p.max_devices === null ? 'Perangkat kasir tanpa batas' : `${p.max_devices} perangkat kasir`,
  )

  out.push(
    k.reports === 'full'
      ? 'Laporan lengkap: laba kotor, produk terlaris, metode bayar, 90 hari'
      : 'Laporan dasar: omset, transaksi, grafik harian, 30 hari',
  )
  out.push(
    k.purchasing === 'full'
      ? 'Pembelian lengkap: pemasok, tempo & hutang, konsinyasi'
      : 'Catat barang masuk, harga pokok ikut diperbarui',
  )
  out.push(
    k.crm === 'full'
      ? 'Pelanggan lengkap: poin loyalty, riwayat belanja, segmentasi'
      : 'Catat pelanggan & kirim nota WhatsApp',
  )
  if (k.api) out.push('Akses API')
  out.push(k.dukunganKartu)

  return out
}

const DASAR = [
  'Kasir offline',
  'Pindai barcode',
  'Struk thermal 58mm',
  'Kartu stok & opname',
  'Shift & selisih kas',
  'Nota via WhatsApp',
  'Tim & hak akses',
]

const TANYA: { t: string; j: string }[] = [
  {
    t: 'Apa yang terjadi setelah masa coba 14 hari habis?',
    j: 'Data Anda tetap utuh dan bisa dibuka. Yang berhenti hanya penerimaan transaksi baru di kasir, sampai langganannya diaktifkan. Tidak ada data yang dihapus karena masa coba berakhir.',
  },
  {
    t: 'Bagaimana cara bayarnya?',
    j: 'Untuk sekarang lewat admin TokoKu: hubungi kami di WhatsApp, paketnya kami aktifkan, dan tagihannya berjalan bulanan. Belum ada pembayaran otomatis di dalam aplikasi.',
  },
  {
    t: 'Kalau saya turun paket, data saya hilang?',
    j: 'Tidak. Turun paket tidak menghapus apa pun. Yang berubah hanya batas penambahan: kalau produk Anda sudah melebihi batas paket baru, Anda tetap bisa berjualan dan mengelola yang ada, cuma tidak bisa menambah sampai kembali di bawah batas.',
  },
  {
    t: 'Printer apa yang bisa dipakai?',
    j: 'Printer thermal 58mm, yang paling banyak dipakai warung. Struk dicetak lewat menu cetak di HP atau komputer, jadi tidak perlu memasang aplikasi tambahan.',
  },
  {
    t: 'Kalau internet mati saat ramai?',
    j: 'Kasir tetap jalan. Transaksi tersimpan di perangkat, nomor struk tetap runut, stok tetap terpotong, lalu semuanya terkirim sendiri begitu sinyal kembali. Ini bukan tambahan, tapi cara kerja bawaannya.',
  },
  {
    t: 'Data toko saya bisa dilihat toko lain?',
    j: 'Tidak. Pemisahan antar toko ditegakkan di lapisan database, bukan sekadar disembunyikan dari layar, jadi permintaan data toko lain ditolak walaupun dikirim di luar aplikasi.',
  },
  {
    t: 'Saya punya dua usaha berbeda. Perlu dua akun?',
    j: 'Tidak. Satu akun boleh memiliki sampai 5 toko yang terpisah penuh: produk, tim, dan laporannya sendiri-sendiri. Berpindah toko cukup lewat pemilih di atas layar. Tiap toko punya langganannya sendiri.',
  },
]

const WA_ADMIN = '6281237597759'

export default async function FiturPage() {
  // Klien TANPA cookie: memanggil `cookies()` membuat rute ini dinamis dan
  // membatalkan `revalidate` di atas tanpa peringatan apa pun.
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('plans')
    .select(
      'code, name, description, price_monthly, max_outlets, max_users, max_products, max_devices, features',
    )
    .eq('is_active', true)
    .order('sort_order')

  const plans = (data ?? []) as PlanRow[]

  return (
    <main className="mk">
      {/* ── Kepala ───────────────────────────────────────────────────────── */}
      <header className="mk-nav">
        <Link href="/" className="mk-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- aset lokal kecil */}
          <img src="/brand/tokoku.png" alt="" width={30} height={30} />
          <span>TokoKu</span>
        </Link>
        <nav className="mk-nav-links">
          <a href="#fitur">Fitur</a>
          <a href="#harga">Harga</a>
          <Link href="/masuk" className="btn btn-dark btn-sm">
            Masuk
          </Link>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mk-hero">
        <p className="mk-eyebrow">POS &amp; ERP untuk retail UMKM</p>
        <h1>
          Kasir yang tetap jalan
          <br />
          saat internet mati.
        </h1>
        <p className="mk-lede">
          Di banyak daerah internet putus beberapa kali sehari. Kasir tidak boleh ikut berhenti.
          TokoKu menyimpan transaksi di perangkat lebih dulu, lalu mengirimkannya sendiri begitu
          sinyal kembali.
        </p>
        <div className="mk-cta">
          <Link href="/daftar-toko" className="btn btn-primary">
            Coba Gratis
          </Link>
          <a href="#harga" className="btn btn-ghost">
            Lihat harga
          </a>
        </div>
        <p className="mk-note">Gratis 14 hari. Tanpa kartu kredit.</p>
      </section>

      {/* ── Empat pilar ──────────────────────────────────────────────────── */}
      <section className="mk-section" id="fitur">
        <div className="mk-grid mk-grid-2">
          {INTI.map((f) => (
            <article className="mk-card mk-card-lg" key={f.judul}>
              <span className="mk-ico">
                <Icon name={f.icon} size={20} />
              </span>
              <h3>{f.judul}</h3>
              <p>{f.isi}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Tangkapan layar ──────────────────────────────────────────────────
          Halaman ini sebelumnya seluruhnya teks, dan itu lubang terbesarnya:
          orang membeli aplikasi kasir dengan mata. Gambarnya diambil dari
          aplikasi yang benar-benar berjalan, bukan mockup, supaya yang dilihat
          calon klien memang yang akan ia dapat.

          `loading="lazy"` dan `width`/`height` eksplisit: ketiganya di bawah
          lipatan layar, dan tanpa ukuran tetap halamannya melompat saat gambar
          selesai diunduh, tepat ketika orang sedang membaca. */}
      <section className="mk-section" id="tampilan">
        <h2 className="mk-h2">Seperti ini tampilannya</h2>
        <p className="mk-sub">
          Diambil langsung dari aplikasinya, bukan gambar rancangan.
        </p>

        <figure className="mk-shot">
          <img
            src="/tangkapan/kasir.jpg"
            alt="Layar kasir TokoKu: grid produk di kiri, keranjang belanja dan tombol bayar di kanan"
            width={1600}
            height={1000}
            loading="lazy"
          />
          <figcaption>
            <strong>Kasir.</strong> Cari produk, pindai barcode, atau tekan
            kartunya. Keranjang dan total selalu terlihat, dan layar ini tetap bekerja
            waktu internet putus.
          </figcaption>
        </figure>

        <div className="mk-shot-duo">
          <figure className="mk-shot">
            <img
              src="/tangkapan/laporan.jpg"
              alt="Halaman laporan TokoKu: omset tujuh hari, jumlah transaksi, laba kotor, dan grafik omset harian"
              width={1600}
              height={1000}
              loading="lazy"
            />
            <figcaption>
              <strong>Laporan.</strong> Omset, laba kotor, dan grafik harian. Bisa
              disaring per cabang atau digabung semuanya.
            </figcaption>
          </figure>

          <figure className="mk-shot">
            <img
              src="/tangkapan/produk.jpg"
              alt="Halaman produk dan stok TokoKu: daftar produk dengan harga pokok, harga jual, dan sisa stok"
              width={1600}
              height={1000}
              loading="lazy"
            />
            <figcaption>
              <strong>Produk & stok.</strong> Harga pokok, harga jual, dan sisa stok
              dalam satu baris. Stok menipis ditandai sendiri.
            </figcaption>
          </figure>
        </div>

        <div className="mk-shot-hp">
          <img
            src="/tangkapan/kasir-hp.jpg"
            alt="Layar kasir TokoKu di layar ponsel, dengan bar bayar menempel di bawah"
            width={360}
            height={780}
            loading="lazy"
          />
          <div>
            <h3>Muat di HP yang sudah Anda punya</h3>
            <p>
              Bukan versi ringkas, melainkan aplikasi yang sama: pindai barcode pakai
              kamera, cetak struk, dan tutup shift, semuanya dari layar ponsel. Tidak
              ada yang perlu dipasang dari toko aplikasi.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pernyataan besar ─────────────────────────────────────────────── */}
      <section className="mk-statement">
        <h2>
          Angka yang keliru lebih<br />
          berbahaya daripada tidak ada angka.
        </h2>
        <p>
          Stok minus tidak disembunyikan, transaksi batal tetap terlihat batal, dan laporan tidak
          pernah menampilkan dua angka berbeda untuk hal yang sama. Kalau ada yang tidak beres,
          TokoKu mengatakannya.
        </p>
      </section>

      {/* ── Fitur lain ───────────────────────────────────────────────────── */}
      <section className="mk-section">
        <h2 className="mk-h2">Semua yang dibutuhkan toko yang tumbuh</h2>
        <div className="mk-grid mk-grid-3">
          {LAINNYA.map((f) => (
            <article className="mk-card" key={f.judul}>
              <span className="mk-ico sm">
                <Icon name={f.icon} size={17} />
              </span>
              <h3>{f.judul}</h3>
              <p>{f.isi}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Harga ────────────────────────────────────────────────────────── */}
      <section className="mk-section" id="harga">
        <h2 className="mk-h2">Harga</h2>
        <p className="mk-sub">
          Satu harga per bulan, per toko. Semua paket memuat kasir offline dan struk thermal.
        </p>

        {/* Yang dasar disebut SEKALI di sini, bukan diulang di tiap kartu.
            Diulang, tiga kartu jadi mirip semua dan pembedanya justru tenggelam. */}
        <div className="mk-included">
          <span className="mk-included-label">Sudah termasuk di semua paket</span>
          <ul>
            {DASAR.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="mk-grid mk-grid-3 mk-price">
          {plans.map((p) => {
            const unggulan = p.code === 'growth'
            return (
              <article className={`mk-card mk-plan${unggulan ? ' is-featured' : ''}`} key={p.code}>
                {unggulan && <span className="mk-badge">Paling banyak dipakai</span>}
                <h3>{p.name}</h3>
                {p.description && <p className="mk-plan-desc">{p.description}</p>}
                <div className="mk-plan-price">
                  {rupiah(p.price_monthly)}
                  <span>/bulan</span>
                </div>
                <ul className="mk-list">
                  {sorotan(p).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <Link
                  href="/daftar-toko"
                  className={`btn ${unggulan ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Coba {p.name} gratis
                </Link>
              </article>
            )
          })}
        </div>

        <p className="mk-note" style={{ textAlign: 'center', marginTop: 22 }}>
          Semua paket mulai dengan masa coba gratis 14 hari, tanpa kartu kredit. Naik atau turun
          paket kapan saja lewat admin TokoKu.
        </p>
      </section>

      {/* ── Perbandingan lengkap ──────────────────────────────────────────── */}
      <section className="mk-section">
        <h2 className="mk-h2">Perbandingan lengkap</h2>
        <p className="mk-sub">
          Semua batas di bawah ini ditegakkan di dalam aplikasi, bukan sekadar janji di halaman ini.
        </p>

        <div className="mk-cmp-scroll">
          <table className="mk-cmp">
            <thead>
              <tr>
                <th scope="col">Kemampuan</th>
                {plans.map((p) => (
                  <th scope="col" key={p.code}>
                    {p.name}
                    <span>{rupiah(p.price_monthly)}/bln</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KELOMPOK.map((g) => (
                <Fragment key={g.judul}>
                  <tr className="mk-cmp-group">
                    <th scope="colgroup" colSpan={plans.length + 1}>
                      {/* Judulnya dibungkus span, dan SPAN itu yang menempel —
                          bukan selnya. Sel ini selebar seluruh tabel, jadi
                          `position: sticky` padanya tidak pernah bekerja:
                          sticky menggeser elemen di dalam wadahnya, dan sel
                          yang sudah selebar wadahnya tidak punya ruang untuk
                          bergeser sama sekali. Akibatnya judul kelompok hanyut
                          keluar layar begitu tabel digeser, dan yang tersisa
                          cuma deretan centang tanpa keterangan. */}
                      <span className="mk-cmp-group-label">{g.judul}</span>
                    </th>
                  </tr>
                  {g.baris.map((b) => (
                    <tr key={b.label}>
                      <th scope="row">{b.label}</th>
                      {plans.map((p) => {
                        const v = b.nilai(p)
                        return (
                          <td key={p.code}>
                            {typeof v === 'boolean' ? (
                              v ? (
                                <>
                                  <Icon name="check" size={15} className="mk-yes" />
                                  <span className="sr-only">Termasuk</span>
                                </>
                              ) : (
                                <span className="mk-no" aria-label="Tidak termasuk">
                                  -
                                </span>
                              )
                            ) : (
                              v
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pertanyaan yang sering ditanyakan ─────────────────────────────── */}
      <section className="mk-section">
        <h2 className="mk-h2">Yang sering ditanyakan</h2>
        <div className="mk-faq">
          {TANYA.map((q) => (
            <details key={q.t}>
              <summary>{q.t}</summary>
              <p>{q.j}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Penutup ──────────────────────────────────────────────────────── */}
      <section className="mk-final">
        <h2>Siap dipakai jualan hari ini.</h2>
        <p>Daftarkan toko Anda, isi produknya, dan kasirnya langsung bisa dipakai.</p>
        <div className="mk-cta" style={{ justifyContent: 'center' }}>
          <Link href="/daftar-toko" className="btn btn-primary">
            Daftarkan Toko
          </Link>
          {/* Sebagian pemilik warung tidak mau mendaftar sebelum bicara dengan
              orangnya dulu. Tanpa pintu ini mereka menutup halaman dan tidak
              meninggalkan jejak apa pun. */}
          <a
            className="btn btn-ghost"
            href={`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(
              'Halo TokoKu, saya mau tanya soal paket dan cara pakainya.',
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="whatsapp" size={16} />
            Tanya dulu lewat WhatsApp
          </a>
        </div>
      </section>

      <footer className="mk-foot">
        <span>TokoKu: POS &amp; ERP retail UMKM</span>
        <span>
          <Link href="/about">Tentang</Link>
          <Link href="/masuk">Masuk</Link>
        </span>
        <span>by Seawise Studio</span>
      </footer>
    </main>
  )
}
