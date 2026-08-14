import { Icon } from '@/components/ui/icons'

/**
 * Pemberitahuan bahwa data GAGAL DIBACA, bukan bahwa datanya tidak ada.
 *
 * `const { data } = await supabase…` membuang `error`, dan query yang gagal
 * mengembalikan `data: null` yang lalu jatuh ke `?? []`. Hasilnya layar yang
 * berkata "belum ada transaksi" padahal yang sebenarnya terjadi adalah "saya
 * tidak bisa membacanya". Untuk pemilik toko, dua kalimat itu menuntut tindakan
 * yang sangat berbeda: yang pertama berarti hari ini sepi, yang kedua berarti
 * ada yang rusak.
 *
 * Sudah menggigit sekali dengan biaya nyata: pengeluaran pertama yang dicatat
 * pemilik project tersimpan rapi di database tapi halamannya menampilkan daftar
 * kosong, dan ia melaporkannya sebagai "tidak tersimpan".
 *
 * Sengaja menyebut bahwa datanya tidak hilang. Orang yang melihat layarnya
 * kosong akan mengetik ulang kalau tidak diberi tahu, dan yang diketik ulang
 * itulah yang benar-benar merusak pembukuan.
 */
export function DataError({ apa }: { apa: string }) {
  return (
    <div className="empty-note" role="alert">
      <Icon name="alert" size={16} style={{ marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        {apa} gagal dimuat, jadi yang tampil di layar ini belum tentu lengkap. Muat ulang
        halamannya; kalau masih sama, hubungi admin TokoKu. Data yang sudah tersimpan tidak
        hilang.
      </div>
    </div>
  )
}
