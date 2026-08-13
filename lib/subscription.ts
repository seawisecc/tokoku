import type { SessionContext } from './auth'

/**
 * Keadaan langganan dari sudut pandang PEMILIK TOKO.
 *
 * Sengaja dihitung ulang di sini, bukan memanggil `org_is_active()` di
 * database: fungsi itu menerima id organisasi apa pun sehingga hak panggilnya
 * dicabut dari `authenticated` (lihat migrasi 0019 & 0021). Aturannya harus
 * PERSIS sama dengan `org_lapsed_at()` — kalau keduanya berbeda, toko akan
 * melihat "aman" lalu ditolak saat menekan Bayar, dan itu terjadi di depan
 * pembeli.
 *
 * Sejak migrasi 0041 ada DUA tanggal yang bisa menghabiskan akses:
 * `trial_ends_at` untuk masa coba, dan `subscription_ends_at` untuk langganan
 * berbayar. Keduanya diperlakukan sama — termasuk aturan "NULL berarti tanpa
 * batas", yang berlaku di sini dan di database.
 */
export type SubscriptionState =
  | { kind: 'ok' }
  | { kind: 'ending'; reason: 'trial' | 'paid'; daysLeft: number; endsAt: Date }
  | { kind: 'lapsed'; reason: 'trial' | 'paid' | 'suspended'; endsAt: Date | null }

/** Sejak berapa hari sebelum habis toko mulai diingatkan. */
const WARN_DAYS = 7

/**
 * Selisih HARI KALENDER, bukan selisih jam.
 *
 * Orang menghitung tanggal: langganan yang habis lusa harus berbunyi "2 hari
 * lagi", bukan "1 hari" karena jamnya kurang beberapa menit dari 48. Aturan
 * yang sama sudah dipakai pengingat jatuh tempo di Pembelian.
 */
function sisaHariKalender(endsAt: Date): number {
  const akhir = new Date(endsAt.toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  const kini = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  return Math.round((akhir - kini) / 864e5)
}

export function subscriptionState(org: SessionContext['org']): SubscriptionState {
  if (!org) return { kind: 'ok' }

  if (org.status === 'suspended' || org.status === 'inactive') {
    return { kind: 'lapsed', reason: 'suspended', endsAt: null }
  }

  // Tanggal mana yang berlaku ditentukan STATUS, sama persis dengan
  // `org_lapsed_at()`. Toko trial tidak dikunci oleh subscription_ends_at, dan
  // sebaliknya — kalau tidak, toko yang naik dari trial ke berbayar akan
  // membawa tanggal trial lamanya dan langsung terkunci.
  const iso = org.status === 'trial' ? org.trialEndsAt : org.subscriptionEndsAt
  const reason: 'trial' | 'paid' = org.status === 'trial' ? 'trial' : 'paid'

  // Tanpa tanggal akhir dianggap aktif — jangan pernah mengunci toko hanya
  // karena kolomnya belum pernah diisi.
  if (!iso) return { kind: 'ok' }

  const endsAt = new Date(iso)
  if (Number.isNaN(endsAt.getTime())) return { kind: 'ok' }

  if (endsAt <= new Date()) return { kind: 'lapsed', reason, endsAt }

  const daysLeft = sisaHariKalender(endsAt)
  if (daysLeft <= WARN_DAYS) return { kind: 'ending', reason, daysLeft, endsAt }

  return { kind: 'ok' }
}

/** true kalau toko sedang tidak boleh membuat transaksi baru. */
export const isLapsed = (s: SubscriptionState) => s.kind === 'lapsed'
