import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/ui/icons'
import { rupiah } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Fitur & Harga | TokoKu',
  description:
    'Kasir yang tetap jalan saat internet mati, stok yang selalu cocok, dan laporan yang bisa dipercaya. TokoKu by Seawise Studio.',
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

export default async function FiturPage() {
  const supabase = await createClient()
  const { data: plans } = await supabase
    .from('plans')
    .select('code, name, description, price_monthly, max_outlets, max_users, max_products, max_devices')
    .eq('is_active', true)
    .order('sort_order')

  const batas = (n: number | null, satuan: string) =>
    n === null ? `${satuan} tanpa batas` : `${n.toLocaleString('id-ID')} ${satuan}`

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

        <div className="mk-grid mk-grid-3 mk-price">
          {(plans ?? []).map((p) => {
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
                  <li>{batas(p.max_outlets, 'outlet')}</li>
                  <li>{batas(p.max_users, 'pengguna')}</li>
                  <li>{batas(p.max_products, 'produk')}</li>
                  <li>{batas(p.max_devices, 'perangkat kasir')}</li>
                  <li>
                    {p.code === 'starter'
                      ? 'Laporan dasar & catat barang masuk'
                      : 'Laporan lengkap, pemasok, konsinyasi, poin loyalty'}
                  </li>
                </ul>
                <Link
                  href="/daftar-toko"
                  className={`btn ${unggulan ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Mulai dengan {p.name}
                </Link>
              </article>
            )
          })}
        </div>

        <p className="mk-note" style={{ textAlign: 'center', marginTop: 22 }}>
          Semua paket mulai dengan masa coba gratis 14 hari. Naik atau turun paket kapan saja lewat
          admin TokoKu.
        </p>
      </section>

      {/* ── Penutup ──────────────────────────────────────────────────────── */}
      <section className="mk-final">
        <h2>Siap dipakai jualan hari ini.</h2>
        <p>Daftarkan toko Anda, isi produknya, dan kasirnya langsung bisa dipakai.</p>
        <Link href="/daftar-toko" className="btn btn-primary">
          Daftarkan Toko
        </Link>
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
