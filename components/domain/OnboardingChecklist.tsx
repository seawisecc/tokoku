import Link from 'next/link'
import type { Route } from 'next'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type OnboardingState = {
  adaProduk: boolean
  adaTransaksi: boolean
  adaTim: boolean
  /** Info toko sudah dilengkapi — alamatnya terisi. Lihat catatan di bawah. */
  infoLengkap: boolean
}

/**
 * Panduan langkah awal untuk toko yang masih kosong.
 *
 * Sebelum ini toko yang baru mendaftar mendarat di beranda berisi "Rp 0" dan
 * empat kartu bernilai nol, tanpa satu pun petunjuk apa yang harus dikerjakan
 * lebih dulu.
 *
 * **Hilang total begitu ada transaksi pertama.** Bukan disembunyikan lewat
 * tombol "jangan tampilkan lagi": daftar yang harus ditutup manual akan
 * menetap di layar orang yang sudah lama memakai aplikasi. Transaksi pertama
 * adalah penanda paling jujur bahwa tokonya sudah benar-benar jalan.
 */
export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  if (state.adaTransaksi) return null

  /**
   * Tiga langkah yang bisa DICENTANG, masing-masing punya penanda yang benar-
   * benar bisa diperiksa dari data.
   *
   * "Buka layar Kasir" sengaja TIDAK ada di daftar ini. Dulu ia jadi butir
   * keempat berpenanda centang yang tidak pernah bisa selesai, sehingga
   * daftarnya menampilkan empat baris sementara hitungannya menyebut tiga —
   * dan orang menghitung ulang mencari langkah mana yang tidak dihitung.
   * Sekarang ia berdiri sendiri di bawah sebagai ajakan penutup.
   */
  const langkah: {
    selesai: boolean
    judul: string
    jelas: string
    aksi: { href: Route; label: string }[]
  }[] = [
    {
      selesai: state.adaProduk,
      judul: 'Masukkan barang dagangan',
      jelas: 'Ketik satu per satu, atau impor sekaligus kalau daftarnya sudah ada di Excel.',
      // Dua pintu, dan yang MANUAL didahulukan. Toko kecil yang barangnya
      // belasan tidak punya berkas Excel apa pun, dan menawarinya impor CSV
      // lebih dulu terbaca seperti aplikasi ini menuntut sesuatu yang tidak
      // dia punya sebelum boleh mulai.
      aksi: [
        { href: '/produk' as Route, label: 'Tambah manual' },
        { href: '/pengaturan/data' as Route, label: 'Impor CSV' },
      ],
    },
    {
      selesai: state.infoLengkap,
      judul: 'Lengkapi info toko',
      jelas: 'Alamat dan nomor telepon ikut tercetak di struk pembeli.',
      aksi: [{ href: '/pengaturan/toko' as Route, label: 'Lengkapi' }],
    },
    {
      selesai: state.adaTim,
      judul: 'Undang kasir Anda',
      jelas: 'Tiap orang dapat akun sendiri, jadi laporan tahu siapa yang melayani.',
      aksi: [{ href: '/pengaturan/tim' as Route, label: 'Undang tim' }],
    },
  ]

  const beres = langkah.filter((l) => l.selesai).length

  return (
    <div className="onb">
      <div className="onb-head">
        <div className="onb-title">Siapkan toko Anda</div>
        <div className="cell-sub">
          {beres} dari {langkah.length} langkah selesai. Panduan ini hilang sendiri setelah
          transaksi pertama.
        </div>
      </div>

      <div className="onb-list">
        {langkah.map((l) => (
          <div key={l.judul} className={cn('onb-item', l.selesai && 'is-done')}>
            <span className="onb-check" aria-hidden>
              {l.selesai && <Icon name="check" size={13} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="onb-item-title">{l.judul}</div>
              <div className="cell-sub">{l.jelas}</div>
            </div>
            <div className="onb-aksi">
              {l.aksi.map((a, i) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn('btn btn-sm', i === 0 ? 'btn-dark' : 'btn-ghost')}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ajakan penutup, di luar daftar centang. Selalu tersedia — kasir bisa
          dicoba kapan saja, bahkan sebelum satu langkah pun selesai. */}
      <Link href={'/kasir' as Route} className="btn btn-primary btn-block onb-mulai">
        <Icon name="cart" size={15} /> Coba layar Kasir
      </Link>
    </div>
  )
}
