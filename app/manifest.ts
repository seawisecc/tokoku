import type { MetadataRoute } from 'next'

/**
 * Manifest PWA — inilah yang membuat Chrome menawarkan "Instal TokoKu".
 *
 * Service worker sudah ada sejak awal (`public/sw.js`), tapi service worker
 * saja tidak pernah cukup: ia membuat aplikasi bertahan tanpa internet,
 * bukan membuatnya bisa dipasang. Syarat pemasangan di Chrome adalah manifest
 * yang menyebut nama, halaman awal, mode tampilan, dan ikon 192 + 512 piksel.
 * Selama salah satunya kurang, tombol instalnya tidak pernah muncul dan tidak
 * ada satu pun pesan yang menjelaskan kenapa.
 *
 * Ditulis sebagai `app/manifest.ts`, bukan berkas statis di `public/`: Next
 * ikut menyisipkan `<link rel="manifest">` ke setiap halaman sendiri. Manifest
 * yang ada tapi tidak pernah ditautkan sama saja dengan tidak ada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` mengunci identitas aplikasi yang sudah terpasang di perangkat.
    // Tanpa ini identitasnya diambil dari `start_url`, jadi mengubah halaman
    // awal suatu hari nanti akan terbaca sebagai APLIKASI BARU: yang sudah
    // dipasang klien tidak ikut diperbarui, dan ikonnya bisa jadi dobel.
    id: '/',

    // Titik dua, BUKAN em dash: ini teks yang dilihat pemilik toko di kotak
    // pemasangan Chrome, dan em dash dilarang di seluruh teks antarmuka.
    name: 'TokoKu: POS & ERP Retail',
    // Yang tampil di bawah ikon layar utama. Dipendekkan karena Android
    // memotongnya sekitar 12 karakter, dan "TokoKu: POS…" terbaca rusak.
    short_name: 'TokoKu',
    description:
      'Kasir yang tetap jalan saat internet mati. Stok, pembelian, pelanggan, dan laporan untuk usaha retail.',

    // `/` adalah pengalih menurut peran (beranda toko, atau /admin untuk Super
    // Admin, atau /masuk kalau belum login). Menunjuk `/beranda` langsung akan
    // memantulkan Super Admin dan orang yang sesinya sudah habis.
    start_url: '/',
    scope: '/',

    // Tanpa bilah alamat browser. Fallback ke `minimal-ui` lalu `browser`
    // diurus browser sendiri lewat `display_override` di bawah.
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],

    lang: 'id',
    dir: 'ltr',
    // `portrait` saja akan MENGUNCI layar kasir yang dipakai di tablet
    // mendatar. Dibiarkan mengikuti perangkat.
    orientation: 'any',

    // Sama dengan `viewport.themeColor` di root layout: bilah status Android
    // ikut warna ini saat aplikasinya terbuka.
    theme_color: '#0E2419',
    // Latar layar pembuka sebelum React sempat menggambar apa pun. Dibuat
    // sama dengan latar aplikasi, bukan putih — kalau berbeda, tiap kali
    // dibuka ada kedipan putih yang terbaca seperti aplikasi gagal muat.
    background_color: '#FAFBF6',

    categories: ['business', 'finance', 'productivity'],

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // WAJIB terpisah dari yang di atas, jangan digabung jadi
      // `purpose: 'any maskable'`. Launcher Android memotong ikon maskable
      // sesuai bentuknya sendiri (lingkaran, kotak membulat, kotak). Logo yang
      // sudah memenuhi kanvas akan kehilangan keempat sudutnya, dan kalau
      // ikon yang sama juga dipakai sebagai 'any', ia tampil terpotong pula di
      // tempat yang tidak memotong apa-apa.
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    // Tekan-lama ikon di layar utama Android. Tiga layar yang benar-benar
    // dibuka berulang kali dalam sehari; menu lain tidak dimasukkan supaya
    // daftarnya tetap bisa dibaca sekilas.
    shortcuts: [
      { name: 'Kasir', short_name: 'Kasir', url: '/kasir' },
      { name: 'Produk & Stok', short_name: 'Produk', url: '/produk' },
      { name: 'Laporan', short_name: 'Laporan', url: '/laporan' },
    ],
  }
}
