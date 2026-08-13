import { Icon } from '@/components/ui/icons'
import { tanggal } from '@/lib/format'
import type { SubscriptionState } from '@/lib/subscription'

/**
 * Kabar langganan untuk pemilik toko.
 *
 * Dulu tidak ada sama sekali: toko baru tahu masa trialnya habis ketika kasir
 * menekan Bayar dan transaksinya ditolak — di depan pembeli. Peringatan ini
 * muncul seminggu sebelumnya supaya keputusan membayar diambil saat tenang,
 * bukan saat panik.
 */
export function SubscriptionBanner({ state }: { state: SubscriptionState }) {
  if (state.kind === 'ok') return null

  if (state.kind === 'ending') {
    // Sejak migrasi 0041 spanduk ini juga dipakai langganan BERBAYAR yang mau
    // habis, bukan cuma masa coba. Kalimatnya harus ikut menyesuaikan: menyebut
    // "masa coba gratis" ke toko yang sudah membayar terbaca seperti aplikasi
    // yang tidak tahu siapa pelanggannya.
    const apa = state.reason === 'trial' ? 'Masa coba gratis' : 'Langganan'
    return (
      <div className="sub-banner is-warn" role="status">
        <Icon name="alert" size={16} />
        <div>
          <strong>
            {state.daysLeft === 1
              ? `${apa} berakhir besok.`
              : `${apa} berakhir ${state.daysLeft} hari lagi.`}
          </strong>{' '}
          Sampai {tanggal(state.endsAt.toISOString())}. Setelah itu kasir tidak bisa mencatat
          penjualan baru.{' '}
          {state.reason === 'trial'
            ? 'Hubungi admin TokoKu untuk berlangganan.'
            : 'Hubungi admin TokoKu untuk memperpanjang.'}
        </div>
      </div>
    )
  }

  return (
    <div className="sub-banner is-bad" role="alert">
      <Icon name="alert" size={16} />
      <div>
        <strong>
          {state.reason === 'trial'
            ? 'Masa coba gratis sudah berakhir.'
            : state.reason === 'paid'
              ? 'Masa langganan toko ini sudah berakhir.'
              : 'Langganan toko ini sedang tidak aktif.'}
        </strong>{' '}
        Kasir tidak bisa mencatat penjualan baru dan data baru tidak bisa ditambah. Semua data
        lama tetap aman dan bisa dilihat. Penjualan yang sudah terlanjur tercatat di perangkat
        tetap akan terkirim. Hubungi admin TokoKu untuk mengaktifkan kembali.
      </div>
    </div>
  )
}
