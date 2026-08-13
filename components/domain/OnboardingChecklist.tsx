import Link from 'next/link'
import type { Route } from 'next'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type OnboardingState = {
  adaProduk: boolean
  adaTransaksi: boolean
  adaTim: boolean
  strukDiatur: boolean
}

/**
 * Panduan langkah awal untuk toko yang masih kosong.
 *
 * Sebelum ini toko yang baru mendaftar mendarat di beranda berisi "Rp 0" dan
 * empat kartu bernilai nol, tanpa satu pun petunjuk apa yang harus dikerjakan
 * lebih dulu. Jalur tercepatnya sudah ada sejak impor CSV dibuat — tapi tidak
 * ada apa pun di layar yang menunjukkannya, dan orang yang baru mendaftar
 * tidak akan menemukan menu Pengaturan → Impor & Backup sendiri.
 *
 * **Hilang total begitu ada transaksi pertama.** Bukan disembunyikan lewat
 * tombol "jangan tampilkan lagi": daftar yang harus ditutup manual akan
 * menetap di layar orang yang sudah lama memakai aplikasi, dan tiap piksel di
 * beranda seharusnya milik angka hari ini. Transaksi pertama adalah penanda
 * paling jujur bahwa tokonya sudah benar-benar jalan.
 *
 * Langkah yang sudah selesai tetap ditampilkan dan dicoret, tidak dibuang dari
 * daftar: yang membuat orang mau menyelesaikan daftar adalah melihat bagian
 * yang sudah beres bertambah.
 */
export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  // Toko yang sudah berjualan tidak butuh panduan memulai.
  if (state.adaTransaksi) return null

  const langkah: {
    selesai: boolean
    judul: string
    jelas: string
    href: Route
    aksi: string
  }[] = [
    {
      selesai: state.adaProduk,
      judul: 'Masukkan barang dagangan',
      jelas: 'Punya daftar di Excel? Impor sekaligus lewat CSV, tidak perlu diketik satu-satu.',
      href: (state.adaProduk ? '/produk' : '/pengaturan/data') as Route,
      aksi: state.adaProduk ? 'Lihat produk' : 'Impor dari CSV',
    },
    {
      selesai: state.strukDiatur,
      judul: 'Atur struk dan printer',
      jelas: 'Pasang logo dan catatan kaki, lalu lihat pratinjaunya sebelum dicetak.',
      href: '/pengaturan/printer' as Route,
      aksi: 'Atur struk',
    },
    {
      selesai: state.adaTim,
      judul: 'Undang kasir Anda',
      jelas: 'Tiap orang dapat akun sendiri, jadi laporan tahu siapa yang melayani.',
      href: '/pengaturan/tim' as Route,
      aksi: 'Undang tim',
    },
    {
      selesai: false,
      judul: 'Buka layar Kasir',
      jelas: 'Coba satu transaksi. Kasir tetap jalan walau internet mati.',
      href: '/kasir' as Route,
      aksi: 'Mulai jualan',
    },
  ]

  const beres = langkah.filter((l) => l.selesai).length

  return (
    <div className="onb">
      <div className="onb-head">
        <div>
          <div className="onb-title">Siapkan toko Anda</div>
          <div className="cell-sub">
            {beres} dari {langkah.length - 1} langkah persiapan selesai. Panduan ini hilang
            sendiri setelah transaksi pertama.
          </div>
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
            <Link href={l.href} className="btn btn-ghost btn-sm">
              {l.aksi}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
