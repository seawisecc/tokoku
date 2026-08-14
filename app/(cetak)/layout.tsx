/**
 * Layout untuk lembar yang dicetak.
 *
 * Route group sendiri, TANPA AppShell. Halaman cetak yang tinggal di dalam
 * `(toko)` akan ikut membawa sidebar, topbar, dan bottom nav ke atas kertas —
 * dan menyembunyikannya lagi lewat CSS cetak berarti mengulang seluruh
 * akrobat `:has()` yang sudah dipakai struk, satu set aturan lagi yang harus
 * ikut diuji tiap kali tata letaknya berubah. Lebih murah tidak merendernya
 * sejak awal.
 *
 * URL-nya tetap `/laporan/cetak` karena nama route group tidak ikut ke path.
 */
export default function CetakLayout({ children }: { children: React.ReactNode }) {
  return <div className="cetak-halaman">{children}</div>
}
