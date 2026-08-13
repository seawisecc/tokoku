import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi | TokoKu',
  description:
    'Data toko Anda bersifat privat. Apa yang disimpan TokoKu, untuk apa, siapa yang bisa melihatnya, dan bagaimana cara menghapusnya.',
}

/**
 * Kebijakan Privasi — versi yang dipublikasikan.
 *
 * Isinya disusun dari kolom yang BENAR-BENAR ada di skema database ini, bukan
 * dari templat umum: setiap jenis data yang disebut memang tersimpan, dan
 * tidak ada yang tersimpan tanpa disebut. Kalau skemanya berubah, dokumen ini
 * ikut diperbarui — itu satu-satunya cara menjaganya tetap jujur.
 *
 * **Nama penyedia infrastruktur sengaja TIDAK disebut.** Keputusan pemilik
 * project (13 Agu), setelah risikonya disampaikan: UU PDP mewajibkan
 * pengungkapan ke mana data pribadi dikirim, terutama lintas negara. Jalan
 * tengah yang dipakai — nama vendor dihapus, FAKTA penyimpanan di luar negeri
 * dipertahankan dalam satu kalimat netral di bagian 6. Jangan menghapus
 * kalimat itu tanpa membicarakannya lagi dengan pemilik project.
 *
 * Yang masih perlu diperbarui kalau berubah: nama badan usaha, alamat resmi,
 * dan alamat kontak privasi.
 */
const TERAKHIR_DIPERBARUI = '13 Agustus 2026'

export default function KebijakanPrivasiPage() {
  return (
    <article className="legal-prose">
      <p className="legal-eyebrow">Dokumen</p>
      <h1>Kebijakan Privasi</h1>
      <p className="legal-meta">Terakhir diperbarui {TERAKHIR_DIPERBARUI}</p>

      <div className="legal-note">
        <strong>Ringkasnya:</strong> data toko Anda bersifat privat. Hanya Anda dan orang yang
        Anda beri akses yang dapat melihatnya. Kami tidak menjual data siapa pun, tidak
        memakainya untuk iklan, dan tidak membukanya kecuali Anda meminta pendampingan atau ada
        gangguan yang harus diperbaiki. Setiap kali kami mengaksesnya, waktunya dan alasannya
        tercatat permanen dan bisa Anda periksa sendiri.
      </div>

      <h2>1. Siapa kami</h2>
      <p>
        TokoKu adalah perangkat lunak kasir dan manajemen toko yang dioperasikan oleh{' '}
        <strong>Seawise Studio</strong>. Dalam dokumen ini, &quot;kami&quot; berarti Seawise
        Studio sebagai penyedia layanan, dan &quot;Anda&quot; berarti pemilik atau pengelola
        toko yang memakai TokoKu.
      </p>

      <h2>2. Dua peran yang berbeda, dan ini penting</h2>
      <p>
        Ada dua jenis data di dalam TokoKu, dan tanggung jawabnya tidak sama:
      </p>
      <ul>
        <li>
          <strong>Data akun dan toko Anda.</strong> Di sini kami adalah Pengendali Data. Kami
          yang menentukan data apa yang dibutuhkan agar layanan bisa berjalan.
        </li>
        <li>
          <strong>Data pelanggan yang Anda catat.</strong> Di sini{' '}
          <strong>Anda yang menjadi Pengendali Data</strong> dan kami hanya Prosesor. Kami
          menyimpan dan mengolahnya atas perintah Anda, tidak untuk kepentingan kami sendiri.
          Konsekuensinya: kewajiban meminta izin pelanggan sebelum mencatat nomor HP-nya ada di
          tangan Anda, bukan kami.
        </li>
      </ul>

      <h2>3. Data yang kami simpan</h2>

      <h3>3.1 Data akun</h3>
      <ul>
        <li>Alamat email dan kata sandi (kata sandi disimpan dalam bentuk teracak, tidak pernah bisa dibaca kembali oleh siapa pun termasuk kami)</li>
        <li>Nama lengkap dan nomor telepon, kalau diisi</li>
        <li>Peran dan izin modul Anda di dalam toko</li>
      </ul>

      <h3>3.2 Data toko</h3>
      <ul>
        <li>Nama toko, kota, alamat, nomor telepon, email, dan logo</li>
        <li>Daftar cabang/outlet</li>
        <li>Daftar produk, kategori, harga, dan stok</li>
        <li>Pemasok dan nota pembelian, kalau dipakai</li>
      </ul>

      <h3>3.3 Data penjualan</h3>
      <ul>
        <li>Setiap transaksi: nomor nota, waktu, barang, jumlah, harga, potongan, metode pembayaran, dan totalnya</li>
        <li>Siapa kasir yang melayani, dan dari perangkat mana</li>
        <li>Riwayat pergerakan stok</li>
      </ul>

      <h3>3.4 Data pelanggan toko Anda</h3>
      <p>
        Hanya yang Anda catat sendiri: <strong>nama</strong>, dan bila diisi{' '}
        <strong>nomor HP, email, alamat, dan catatan</strong>. Dari transaksi, sistem juga
        menghitung total belanja, jumlah kunjungan, kunjungan terakhir, dan saldo poin.
      </p>
      <p>
        Kami tidak pernah menambahkan data pelanggan dari sumber lain, tidak menggabungkannya
        dengan data toko lain, dan tidak memakainya untuk apa pun di luar toko Anda sendiri.
      </p>

      <h3>3.5 Data teknis</h3>
      <ul>
        <li>Perangkat kasir yang terdaftar dan waktu sinkronisasi terakhirnya</li>
        <li>Catatan kegagalan sinkronisasi, untuk menelusuri penjualan yang gagal masuk</li>
        <li>Log server teknis berisi alamat IP dan waktu akses, dipakai untuk menelusuri gangguan</li>
      </ul>
      <p>
        Kami <strong>tidak</strong> memakai cookie pelacak, tidak memasang pixel iklan, dan
        tidak memakai layanan analitik pihak ketiga. Cookie yang dipakai hanya untuk menjaga
        sesi login dan mengingat toko/cabang mana yang sedang Anda buka.
      </p>

      <h2>4. Untuk apa data dipakai</h2>
      <ul>
        <li>Menjalankan layanan: mencatat penjualan, menghitung stok, dan menyusun laporan</li>
        <li>Menagih dan mengelola langganan Anda</li>
        <li>Mengirim email yang berkaitan dengan akun: undangan tim, konfirmasi pendaftaran, dan pengaturan ulang kata sandi</li>
        <li>Menanggapi permintaan bantuan Anda</li>
        <li>Menjaga keamanan, misalnya menelusuri akses yang mencurigakan</li>
      </ul>
      <p>
        Kami <strong>tidak</strong> menjual data Anda, tidak menyewakannya, dan tidak
        memakainya untuk melatih model kecerdasan buatan.
      </p>

      <h2>5. Siapa yang bisa melihat data Anda</h2>
      <p>
        <strong>Data toko Anda bersifat privat.</strong> Ia tidak dapat dilihat oleh pemilik
        toko lain, tidak dipertukarkan antar akun, dan tidak pernah digabungkan dengan data
        toko mana pun. Pemisahan ini ditegakkan di lapisan basis data, bukan sekadar di
        tampilan — artinya tetap berlaku sekalipun terjadi kesalahan pemrograman di sisi
        antarmuka.
      </p>
      <ul>
        <li>
          <strong>Anda, sebagai pemilik akun.</strong> Akses penuh ke seluruh data toko Anda.
        </li>
        <li>
          <strong>Orang yang Anda undang</strong>, sebatas izin modul yang Anda tentukan
          sendiri. Anda dapat mencabutnya kapan saja.
        </li>
        <li>
          <strong>Tim kami, hanya bila dibutuhkan.</strong> Kami membuka data toko Anda semata
          untuk memberikan pendampingan yang Anda minta atau memperbaiki gangguan pada
          aplikasi. Di luar dua keadaan itu, kami tidak membukanya.
        </li>
      </ul>
      <p>
        Akses kami dibatasi dan diawasi dengan tiga cara sekaligus:
      </p>
      <ul>
        <li>
          <strong>Hanya baca.</strong> Mode pendampingan tidak dapat mengubah, menambah, atau
          menghapus data apa pun di toko Anda.
        </li>
        <li>
          <strong>Selalu tercatat.</strong> Setiap akses menyimpan siapa yang membuka, kapan,
          dan untuk alasan apa.
        </li>
        <li>
          <strong>Terbuka untuk Anda.</strong> Catatan itu bukan catatan internal kami — Anda
          dapat melihatnya sendiri di halaman detail toko Anda.
        </li>
      </ul>
      <p>
        Kami akan menyerahkan data hanya bila diwajibkan oleh hukum yang berlaku, dan akan
        memberi tahu Anda lebih dulu sepanjang hal itu tidak dilarang.
      </p>

      <h2>6. Keamanan dan penyimpanan</h2>
      <p>
        Data Anda disimpan pada layanan pusat data profesional dengan standar keamanan
        industri, dan seluruh pengiriman data antara perangkat Anda dan server dilindungi
        enkripsi. Untuk menjaga kecepatan aplikasi bagi pengguna di Indonesia, servernya
        berada di kawasan Asia Tenggara.
      </p>
      <p>
        Kami tidak menempatkan data Anda pada layanan periklanan, tidak membagikannya kepada
        mitra pemasaran, dan tidak memakainya untuk melatih model kecerdasan buatan.
      </p>

      <h2>7. Berapa lama disimpan</h2>
      <ul>
        <li>
          <strong>Selama langganan berjalan:</strong> seluruh data toko tetap tersimpan agar
          laporan lama tetap bisa dibuka.
        </li>
        <li>
          <strong>Setelah langganan berakhir:</strong> data tetap tersimpan dan bisa dilihat.
          Yang berhenti hanyalah pencatatan penjualan baru.
        </li>
        <li>
          <strong>Bila Anda meminta penghapusan:</strong> kami menghapusnya dalam 30 hari
          kerja, kecuali bagian yang wajib disimpan menurut hukum.
        </li>
        <li>
          <strong>Catatan transaksi tidak bisa dihapus satuan.</strong> Nota yang keliru
          dibatalkan, bukan dihapus, sehingga nomornya tidak bolong. Ini disengaja: pembukuan
          yang bisa dihapus sebagian tidak bisa dipertanggungjawabkan.
        </li>
      </ul>

      <h2>8. Hak Anda</h2>
      <p>Sesuai UU PDP, Anda berhak untuk:</p>
      <ul>
        <li>Mengetahui data apa yang kami simpan tentang Anda</li>
        <li>
          Memperoleh salinannya. Untuk sebagian besar data, Anda bisa mengunduhnya sendiri
          kapan saja lewat <strong>Pengaturan → Impor &amp; Backup</strong> dalam bentuk CSV
        </li>
        <li>Memperbaiki data yang keliru</li>
        <li>Meminta penghapusan akun dan data Anda</li>
        <li>Menarik persetujuan, dengan akibat layanan tidak lagi bisa dijalankan</li>
        <li>Mengajukan keberatan atas cara kami memproses data Anda</li>
      </ul>
      <p>
        Bila pelanggan toko Anda mengajukan hak-hak ini kepada Anda, Anda dapat memenuhinya
        sendiri lewat halaman Pelanggan. Bila butuh bantuan, hubungi kami.
      </p>

      <h2>9. Keamanan</h2>
      <p>
        Keamanan data Anda kami perlakukan sebagai syarat layanan, bukan fitur tambahan.
      </p>
      <ul>
        <li>
          <strong>Terenkripsi saat dikirim.</strong> Seluruh sambungan antara perangkat Anda
          dan server memakai HTTPS.
        </li>
        <li>
          <strong>Terpisah antar toko di lapisan basis data.</strong> Pemisahan ini bekerja di
          tingkat penyimpanan, bukan hanya di tampilan — sehingga data toko Anda tetap tidak
          dapat dijangkau toko lain sekalipun terjadi kesalahan pemrograman pada antarmuka.
        </li>
        <li>
          <strong>Kata sandi tidak dapat dibaca siapa pun.</strong> Disimpan dalam bentuk
          teracak satu arah, termasuk tidak dapat dibaca oleh tim kami.
        </li>
        <li>
          <strong>Akses tim kami selalu tercatat</strong> dan dapat Anda periksa sendiri.
        </li>
        <li>
          <strong>Salinan data selalu di tangan Anda.</strong> Anda dapat mengunduh seluruh
          data toko kapan saja dalam bentuk CSV, tanpa perlu meminta kepada kami.
        </li>
      </ul>
      <p>
        Tidak ada sistem yang sepenuhnya kebal, dan kami tidak akan berpura-pura sebaliknya.
        Bila terjadi kebocoran data pribadi, kami akan memberi tahu Anda dan pihak berwenang
        paling lambat 3x24 jam sejak diketahui, sebagaimana diatur UU No. 27 Tahun 2022 tentang
        Pelindungan Data Pribadi.
      </p>

      <h2>10. Anak-anak</h2>
      <p>
        TokoKu ditujukan untuk pelaku usaha dan tidak diperuntukkan bagi anak di bawah 18
        tahun. Kami tidak dengan sengaja mengumpulkan data anak.
      </p>

      <h2>11. Perubahan kebijakan</h2>
      <p>
        Bila kebijakan ini berubah secara berarti, kami akan memberi tahu lewat email atau
        pemberitahuan di dalam aplikasi sebelum perubahannya berlaku.
      </p>

      <h2>12. Menghubungi kami</h2>
      <p>
        Pertanyaan, permintaan salinan data, atau permintaan penghapusan bisa dikirim ke{' '}
        <a href="mailto:seawise.cc@gmail.com">seawise.cc@gmail.com</a>. Kami berusaha menjawab
        dalam 7 hari kerja.
      </p>
    </article>
  )
}
