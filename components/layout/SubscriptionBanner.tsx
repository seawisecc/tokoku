import Link from 'next/link'
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
/**
 * `bisaBayar` sengaja dioper dari luar, tidak disimpulkan di sini.
 *
 * Spanduk ini dirender untuk SEMUA peran di AppShell, termasuk kasir yang tidak
 * memegang izin `settings` — dan itu memang benar: kalau langganan habis, kasir
 * pun berhenti bisa menerima uang, jadi ia berhak tahu sebelum antreannya
 * mengular. Tapi tautan ke halaman Langganan hanya boleh muncul untuk orang
 * yang benar-benar bisa membukanya. Tautan yang memantulkan orang kembali
 * terbaca seperti aplikasi rusak, dan celah izin sejenis sudah pernah terjadi
 * di Transfer Stok dan di Pengeluaran.
 */
export function SubscriptionBanner({
  state,
  bisaBayar = false,
}: {
  state: SubscriptionState
  bisaBayar?: boolean
}) {
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
          {bisaBayar ? (
            <Link href="/pengaturan/langganan" className="sub-banner-link">
              {state.reason === 'trial' ? 'Berlangganan sekarang' : 'Perpanjang sekarang'}
            </Link>
          ) : state.reason === 'trial' ? (
            'Hubungi admin TokoKu untuk berlangganan.'
          ) : (
            'Hubungi admin TokoKu untuk memperpanjang.'
          )}
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
        tetap akan terkirim.{' '}
        {bisaBayar && state.reason !== 'suspended' ? (
          <Link href="/pengaturan/langganan" className="sub-banner-link">
            Bayar sekarang untuk mengaktifkan kembali
          </Link>
        ) : (
          'Hubungi admin TokoKu untuk mengaktifkan kembali.'
        )}
      </div>
    </div>
  )
}
