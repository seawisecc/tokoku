import { deviceStillExists, registerDevice } from '@/app/(toko)/kasir/actions'
import { deviceKey, getMeta, setMeta } from './db'

export type DeviceInfo = { id: string; code: string }

/**
 * Ambil identitas perangkat POS ini, daftarkan kalau belum ada.
 *
 * Promise-nya di-memo di tingkat modul. Tanpa itu, React StrictMode (dan
 * navigasi cepat bolak-balik) memanggil efek inisialisasi dua kali; keduanya
 * membaca meta yang masih kosong lalu sama-sama mendaftar, sehingga satu
 * browser mendapat dua kode perangkat. Kode perangkat ikut ke nomor transaksi,
 * jadi duplikat semacam itu mengotori penomoran secara permanen.
 *
 * Memonya DIKUNCI PER OUTLET. Perangkat POS terdaftar per outlet
 * (`devices.outlet_id`) dan kodenya ikut ke nomor transaksi; memo tingkat modul
 * yang tidak peduli outlet akan tetap menyerahkan perangkat cabang lama setelah
 * kasir berpindah cabang.
 *
 * Metanya sendiri juga berkunci outlet (`deviceKey`), sehingga kembali ke cabang
 * yang sudah pernah dibuka memakai perangkat yang SAMA — bukan mendaftarkan yang
 * baru dan memakan jatah `max_devices`.
 */
let inflight: Promise<DeviceInfo | { error: string }> | null = null
let inflightOutlet: string | null = null

export function getOrRegisterDevice(
  outletId: string,
  online = true,
): Promise<DeviceInfo | { error: string }> {
  if (!inflight || inflightOutlet !== outletId) {
    inflightOutlet = outletId
    inflight = (async () => {
      const cached = await getMeta<DeviceInfo>(deviceKey(outletId))
      if (cached) {
        /**
         * Dipercaya mentah-mentah saat OFFLINE, diperiksa saat online.
         *
         * Perangkat bisa dihapus pemilik toko lewat Pengaturan → Sinkronisasi.
         * Id yang mengendap di sini lalu menunjuk baris yang sudah tidak ada,
         * dan kasirnya tersangkut di "Menyiapkan perangkat…" tanpa pesan apa
         * pun. Kalau ternyata sudah hilang, catatannya dibuang dan perangkat
         * ini mendaftar ulang — kasir cuma melihat kode barunya, bukan layar
         * yang mati.
         *
         * Saat offline pemeriksaan tidak mungkin dilakukan, dan menahan kasir
         * karena itu jauh lebih buruk daripada memakai id yang mungkin basi:
         * transaksinya toh baru dikirim setelah jaringan kembali.
         */
        if (!online) return cached
        try {
          if (await deviceStillExists(cached.id)) return cached
          await setMeta(deviceKey(outletId), null)
        } catch {
          // Gagal memeriksa (jaringan putus di tengah) bukan bukti perangkatnya
          // hilang. Pakai yang ada.
          return cached
        }
      }

      const result = await registerDevice()
      if ('error' in result) {
        inflight = null // biar bisa dicoba lagi nanti
        inflightOutlet = null
        return result
      }

      await setMeta(deviceKey(outletId), result)
      return result
    })()
  }
  return inflight
}
