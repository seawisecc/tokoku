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
 */
export type SubscriptionState =
  | { kind: 'ok' }
  | { kind: 'ending'; daysLeft: number; endsAt: Date }
  | { kind: 'lapsed'; reason: 'trial' | 'suspended'; endsAt: Date | null }

/** Sejak berapa hari sebelum habis toko mulai diingatkan. */
const WARN_DAYS = 7

export function subscriptionState(org: SessionContext['org']): SubscriptionState {
  if (!org) return { kind: 'ok' }

  if (org.status === 'suspended' || org.status === 'inactive') {
    return { kind: 'lapsed', reason: 'suspended', endsAt: null }
  }

  // Trial tanpa tanggal akhir dianggap aktif — jangan pernah mengunci toko
  // hanya karena tanggalnya belum pernah diisi.
  if (org.status !== 'trial' || !org.trialEndsAt) return { kind: 'ok' }

  const endsAt = new Date(org.trialEndsAt)
  if (Number.isNaN(endsAt.getTime())) return { kind: 'ok' }

  const now = new Date()
  if (endsAt <= now) return { kind: 'lapsed', reason: 'trial', endsAt }

  const msLeft = endsAt.getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / 86_400_000)
  if (daysLeft <= WARN_DAYS) return { kind: 'ending', daysLeft, endsAt }

  return { kind: 'ok' }
}

/** true kalau toko sedang tidak boleh membuat transaksi baru. */
export const isLapsed = (s: SubscriptionState) => s.kind === 'lapsed'
