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
    return (
      <div className="sub-banner is-warn" role="status">
        <Icon name="alert" size={16} />
        <div>
          <strong>
            {state.daysLeft === 1
              ? 'Masa coba gratis berakhir besok.'
              : `Masa coba gratis berakhir ${state.daysLeft} hari lagi.`}
          </strong>{' '}
          Sampai {tanggal(state.endsAt.toISOString())}. Setelah itu kasir tidak bisa mencatat
          penjualan baru. Hubungi admin TokoKu untuk berlangganan.
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
            : 'Langganan toko ini sedang tidak aktif.'}
        </strong>{' '}
        Kasir tidak bisa mencatat penjualan baru dan data baru tidak bisa ditambah. Semua data
        lama tetap aman dan bisa dilihat. Penjualan yang sudah terlanjur tercatat di perangkat
        tetap akan terkirim. Hubungi admin TokoKu untuk mengaktifkan kembali.
      </div>
    </div>
  )
}
