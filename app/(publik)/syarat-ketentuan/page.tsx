import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan | TokoKu',
  description:
    'Aturan pemakaian TokoKu: langganan, pembayaran, kepemilikan data, batas tanggung jawab, dan penghentian layanan.',
}

/**
 * Syarat & Ketentuan — versi yang dipublikasikan.
 *
 * Isinya sengaja mengikuti cara aplikasi ini BENAR-BENAR bekerja hari ini,
 * termasuk hal yang kurang menguntungkan penyedia — misalnya belum adanya
 * jaminan ketersediaan berangka. Menuliskan janji yang tidak bisa ditepati
 * adalah cara tercepat kehilangan perkara.
 *
 * Sejalan dengan Kebijakan Privasi, nama penyedia infrastruktur tidak disebut
 * di sini. Yang perlu diperbarui kalau berubah: badan hukum, alamat resmi,
 * angka ganti rugi maksimum di bagian 10, dan bagian 8 begitu pencadangan
 * berkala sudah berjalan.
 */
const TERAKHIR_DIPERBARUI = '13 Agustus 2026'

export default function SyaratKetentuanPage() {
  return (
    <article className="legal-prose">
      <p className="legal-eyebrow">Dokumen</p>
      <h1>Syarat &amp; Ketentuan</h1>
      <p className="legal-meta">Terakhir diperbarui {TERAKHIR_DIPERBARUI}</p>

      <div className="legal-note">
        <strong>Ringkasnya:</strong> Data toko Anda milik Anda, bersifat privat, dan bisa
        diunduh kapan saja.
        Langganan dibayar di muka dan tidak otomatis diperpanjang. Kalau layanan berhenti,
        penjualan baru tidak bisa dicatat, tapi data lama tidak hilang dan tetap bisa diunduh.
      </div>

      <h2>1. Persetujuan</h2>
      <p>
        Dengan mendaftar dan memakai TokoKu, Anda menyetujui syarat ini. Bila Anda mendaftar
        atas nama sebuah usaha, Anda menyatakan berwenang mewakili usaha tersebut.
      </p>

      <h2>2. Layanan</h2>
      <p>
        TokoKu adalah perangkat lunak kasir dan manajemen toko berbasis langganan, dioperasikan
        oleh <strong>Seawise Studio</strong>. Fitur yang tersedia mengikuti paket yang Anda
        pilih.
      </p>

      <h2>3. Akun</h2>
      <ul>
        <li>Satu akun boleh memiliki paling banyak 5 toko.</li>
        <li>
          Anda bertanggung jawab atas kerahasiaan kata sandi dan atas semua yang dilakukan
          akun-akun yang Anda undang ke toko Anda.
        </li>
        <li>Beri tahu kami segera bila Anda menduga akun Anda diakses orang lain.</li>
      </ul>

      <h2>4. Masa coba gratis</h2>
      <p>
        Toko baru mendapat masa coba gratis. <strong>Masa coba melekat pada akun, bukan pada
        toko:</strong> toko kedua dan seterusnya yang Anda buat memakai tanggal berakhir yang
        sama dengan toko pertama Anda. Tidak ada kartu kredit yang diminta, dan tidak ada
        penagihan otomatis setelah masa coba berakhir.
      </p>

      <h2>5. Langganan dan pembayaran</h2>
      <ul>
        <li>Langganan dibayar di muka untuk periode yang disepakati.</li>
        <li>
          Pembayaran saat ini dikonfirmasi secara manual. Masa aktif toko Anda diperpanjang
          setelah pembayaran kami terima.
        </li>
        <li>
          <strong>Tidak ada perpanjangan otomatis.</strong> Layanan berhenti mencatat penjualan
          baru bila masa aktif lewat tanpa perpanjangan.
        </li>
        <li>
          Harga dapat berubah. Perubahan harga diberitahukan paling lambat 30 hari sebelum
          berlaku dan tidak berlaku surut untuk periode yang sudah dibayar.
        </li>
        <li>
          Pembayaran yang sudah masuk tidak dikembalikan, kecuali layanan tidak dapat kami
          sediakan sama sekali.
        </li>
      </ul>

      <h2>6. Bila langganan berakhir</h2>
      <p>Yang terjadi, dan yang tidak terjadi:</p>
      <ul>
        <li>Kasir berhenti bisa mencatat penjualan baru.</li>
        <li>Data baru tidak bisa ditambahkan.</li>
        <li>
          <strong>Seluruh data lama tetap ada, tetap bisa dilihat, dan tetap bisa diunduh.</strong>
        </li>
        <li>
          Penjualan yang terlanjur tercatat di perangkat saat offline tetap akan terkirim dan
          tercatat.
        </li>
      </ul>

      <h2>7. Data Anda milik Anda</h2>
      <ul>
        <li>
          Anda tetap pemilik seluruh data toko, produk, pelanggan, dan transaksi yang Anda
          masukkan.
        </li>
        <li>
          Anda dapat mengunduh salinannya kapan saja dalam bentuk CSV lewat{' '}
          <strong>Pengaturan → Impor &amp; Backup</strong>, termasuk setelah langganan
          berakhir.
        </li>
        <li>
          Kami tidak memakai data Anda untuk kepentingan lain. Lihat{' '}
          <Link href="/kebijakan-privasi">Kebijakan Privasi</Link>.
        </li>
        <li>
          Bila Anda mencatat data pelanggan, <strong>Anda</strong> yang bertanggung jawab
          memperoleh izin dari pelanggan tersebut sesuai UU PDP.
        </li>
      </ul>

      <h2>8. Ketersediaan layanan dan pencadangan</h2>
      <p>
        Kami berusaha menjaga layanan tetap tersedia setiap saat, namun belum menawarkan
        jaminan ketersediaan dengan angka tertentu. Layanan dapat berhenti sementara untuk
        pemeliharaan atau karena gangguan teknis di luar kendali kami.
      </p>
      <p>
        Terlepas dari itu, <strong>salinan data Anda selalu berada di tangan Anda sendiri</strong>.
        Kami menyarankan Anda mengunduhnya secara berkala lewat menu Impor &amp; Backup dan
        menyimpannya di tempat yang bukan perangkat yang sama.
      </p>

      <h2>9. Yang tidak boleh dilakukan</h2>
      <ul>
        <li>Memakai TokoKu untuk kegiatan yang melanggar hukum Indonesia</li>
        <li>Mencoba mengakses data toko lain, atau menembus pembatasan teknis apa pun</li>
        <li>Menjual kembali atau menyewakan akses TokoKu tanpa perjanjian tertulis dari kami</li>
        <li>Membebani sistem secara tidak wajar sehingga mengganggu pengguna lain</li>
      </ul>
      <p>
        Pelanggaran dapat berujung pada penangguhan akun. Untuk pelanggaran yang tidak
        membahayakan pengguna lain, kami akan memberi peringatan lebih dulu.
      </p>

      <h2>10. Batas tanggung jawab</h2>
      <p>
        TokoKu disediakan sebagaimana adanya. Sejauh diizinkan hukum, tanggung jawab kami atas
        kerugian yang timbul dari pemakaian layanan dibatasi paling banyak sebesar biaya
        langganan yang Anda bayarkan dalam 3 bulan terakhir.
      </p>
      <p>
        Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan
        keuntungan, kehilangan pelanggan, atau kerugian akibat kesalahan pencatatan yang
        dilakukan pengguna sendiri.
      </p>

      <h2>11. Penghentian</h2>
      <ul>
        <li>
          Anda dapat berhenti kapan saja. Unduh salinan data Anda lebih dulu, lalu beri tahu
          kami bila ingin akunnya dihapus.
        </li>
        <li>
          Kami dapat menghentikan layanan bila terjadi pelanggaran berat pada bagian 9, atau
          bila layanan ini dihentikan seluruhnya. Untuk penghentian seluruh layanan, kami akan
          memberi tahu paling lambat 60 hari sebelumnya agar Anda punya waktu memindahkan data.
        </li>
      </ul>

      <h2>12. Perubahan syarat</h2>
      <p>
        Perubahan yang berarti akan diberitahukan lewat email atau di dalam aplikasi paling
        lambat 30 hari sebelum berlaku.
      </p>

      <h2>13. Hukum yang berlaku</h2>
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Perselisihan diupayakan diselesaikan
        secara musyawarah lebih dulu.
      </p>

      <h2>14. Menghubungi kami</h2>
      <p>
        <a href="mailto:seawise.cc@gmail.com">seawise.cc@gmail.com</a>
      </p>
    </article>
  )
}
