import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Plus_Jakarta_Sans, Sora } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-jb',
  display: 'swap',
})

const DESKRIPSI =
  'Kasir yang tetap jalan saat internet mati. Stok, pembelian, pelanggan, dan laporan untuk usaha retail. TokoKu by Seawise Studio.'

export const metadata: Metadata = {
  /**
   * `metadataBase` WAJIB ada supaya `og:image` ditulis sebagai URL absolut.
   * WhatsApp mengambil gambarnya dari servernya sendiri, bukan dari browser
   * pembaca, jadi path relatif tidak akan pernah bisa dijangkau dan kartunya
   * muncul tanpa gambar.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://tokoku.seawise.id'),
  title: 'TokoKu | POS & ERP Retail UMKM',
  description: DESKRIPSI,
  applicationName: 'TokoKu',
  /**
   * iOS tidak membaca seluruh manifest PWA. Tanpa blok ini, "Tambah ke Layar
   * Utama" di iPhone menghasilkan pintasan yang tetap membuka bilah alamat
   * Safari — bukan aplikasi. `apple-icon.png` di folder ini yang jadi ikonnya.
   *
   * `statusBarStyle` sengaja bukan 'black-translucent': gaya itu menaruh isi
   * halaman DI BAWAH jam dan indikator baterai, jadi baris pertama topbar
   * tertutup di setiap layar.
   */
  appleWebApp: {
    capable: true,
    title: 'TokoKu',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    siteName: 'TokoKu',
    locale: 'id_ID',
    title: 'TokoKu: kasir yang tetap jalan saat internet mati',
    description: DESKRIPSI,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TokoKu: kasir yang tetap jalan saat internet mati',
    description: DESKRIPSI,
  },
}

export const viewport: Viewport = {
  themeColor: '#0E2419',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sora.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <head>
        {/*
          Tangkap `beforeinstallprompt` SEBELUM React sempat hidrasi.

          Chrome menyalakan event ini sekali saja, segera setelah manifest
          dibaca dan service worker aktif. Pada kunjungan KEDUA dan seterusnya
          service workernya sudah hidup sejak awal, jadi eventnya bisa lewat
          jauh sebelum komponen React mana pun sempat memasang pendengarnya —
          dan yang hilang bukan sekadar spanduk: tanpa event itu tersimpan,
          `prompt()` tidak bisa dipanggil lagi sama sekali, sehingga tombol
          Pasang tidak akan pernah muncul untuk orang yang pernah membuka
          aplikasi ini. Persis bentuk "tombol yang tidak melakukan apa-apa"
          yang sudah pernah menggigit di lonceng notifikasi.

          Ditulis inline dan ditaruh di head karena satu-satunya gunanya
          adalah berjalan lebih dulu daripada apa pun. `preventDefault`
          menahan tawaran bawaan browser supaya tidak muncul dua kali.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__tokokuPasang=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__tokokuPasang=e;dispatchEvent(new Event('tokoku:pasang-siap'))});addEventListener('appinstalled',function(){window.__tokokuPasang=null;dispatchEvent(new Event('tokoku:pasang-selesai'))})",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
