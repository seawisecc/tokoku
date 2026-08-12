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
      <body>{children}</body>
    </html>
  )
}
