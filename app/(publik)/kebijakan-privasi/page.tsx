import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi | TokoKu',
  description:
    'Data apa yang disimpan TokoKu, untuk apa, disimpan di mana, dan bagaimana cara menghapusnya.',
}

/**
 * ⚠ DRAF. BELUM DITINJAU AHLI HUKUM.
 *
 * Isinya disusun dari kolom yang BENAR-BENAR ada di skema database ini, bukan
 * dari templat umum — jadi setiap jenis data yang disebut di bawah memang
 * tersimpan, dan tidak ada yang tersimpan tanpa disebut. Itu yang membuat
 * dokumen ini berguna untuk ditinjau: yang meninjau tidak perlu membongkar
 * kodenya sendiri.
 *
 * Yang HARUS diisi/diperiksa pemilik project sebelum dipakai:
 *  - Nama badan usaha dan alamat resminya (sekarang masih "Seawise Studio")
 *  - Email & nomor kontak privasi yang benar-benar dibaca
 *  - Keputusan soal transfer data ke luar negeri (lihat bagian 6) — ini poin
 *    yang paling mungkin bermasalah dan tidak bisa diputuskan agen
 */
const TERAKHIR_DIPERBARUI = '13 Agustus 2026'

export default function KebijakanPrivasiPage() {
  return (
    <article className="legal-prose">
      <p className="legal-eyebrow">Dokumen</p>
      <h1>Kebijakan Privasi</h1>
      <p className="legal-meta">Terakhir diperbarui {TERAKHIR_DIPERBARUI}</p>

      <div className="legal-note">
        <strong>Ringkasnya:</strong> TokoKu menyimpan data toko Anda dan data pelanggan yang
        Anda catat sendiri, di server Singapura, selama Anda masih berlangganan. Kami tidak
        menjual data siapa pun, tidak memakainya untuk iklan, dan tidak melihat isinya kecuali
        Anda meminta bantuan. Semua akses kami ke toko Anda tercatat dan bisa Anda lihat.
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
        <li>Log server dari penyedia hosting, berisi alamat IP dan waktu akses</li>
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
      <ul>
        <li>
          <strong>Anda dan tim yang Anda undang</strong>, sebatas izin modul yang Anda berikan.
        </li>
        <li>
          <strong>Kami, hanya bila perlu.</strong> Untuk menangani keluhan atau memperbaiki
          masalah, tim kami dapat membuka toko Anda dalam mode lihat-saja. Setiap kali itu
          terjadi, waktunya dan alasannya tercatat permanen dan{' '}
          <strong>bisa Anda lihat sendiri</strong> di halaman detail toko. Mode ini tidak bisa
          mengubah data apa pun.
        </li>
        <li>
          <strong>Penyedia infrastruktur</strong> yang kami pakai, sebatas menyimpan dan
          mengantarkan data. Daftarnya ada di bagian 6.
        </li>
      </ul>
      <p>
        Kami akan menyerahkan data hanya bila diwajibkan hukum yang berlaku, dan akan memberi
        tahu Anda lebih dulu sepanjang itu tidak dilarang.
      </p>

      <h2>6. Di mana data disimpan</h2>
      <p>
        Data TokoKu disimpan dan diproses di <strong>Singapura</strong>, memakai penyedia
        berikut:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — basis data, autentikasi, dan penyimpanan berkas
          (wilayah <span className="mono">ap-southeast-1</span>)
        </li>
        <li>
          <strong>Vercel</strong> — menjalankan aplikasinya (wilayah{' '}
          <span className="mono">sin1</span>)
        </li>
        <li>
          <strong>Resend</strong> — pengiriman email akun
        </li>
      </ul>
      <div className="legal-note is-warn">
        <strong>Perlu ditinjau sebelum dokumen ini dipakai.</strong> Karena data diproses di
        luar wilayah Indonesia, UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi
        mensyaratkan dasar hukum khusus untuk transfer keluar negeri. Bagian ini perlu
        ditinjau ahli hukum dan mungkin perlu ditambahi rumusan persetujuan yang tepat, atau
        dipindahkan ke penyedia berwilayah Indonesia.
      </div>

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
      <ul>
        <li>Seluruh sambungan memakai HTTPS</li>
        <li>
          Pemisahan antar toko ditegakkan di lapisan basis data, bukan hanya di tampilan.
          Artinya toko lain tidak bisa membaca data Anda bahkan bila terjadi kesalahan
          pemrograman di sisi tampilan
        </li>
        <li>Kata sandi disimpan teracak satu arah</li>
        <li>Setiap akses tim kami ke toko klien tercatat</li>
      </ul>
      <p>
        Tidak ada sistem yang sepenuhnya kebal. Bila terjadi kebocoran data pribadi, kami akan
        memberi tahu Anda dan pihak berwenang paling lambat 3x24 jam sejak diketahui,
        sebagaimana diatur UU PDP.
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
