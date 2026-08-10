import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type Quota = {
  maxOutlets: number | null
  maxUsers: number | null
  maxProducts: number | null
  maxDevices: number | null
  usedOutlets: number
  usedUsers: number
  usedProducts: number
  usedDevices: number
}

export type QuotaLine = {
  label: string
  used: number
  limit: number | null
  /** Kalimat yang dilihat pemilik toko kalau ia menabrak batas ini. */
  hint: string
}

/** Ambang "hampir penuh". Di bawah ini tidak perlu diributkan. */
const WARN_AT = 0.8

export function quotaLines(q: Quota): QuotaLine[] {
  return [
    { label: 'Outlet', used: q.usedOutlets, limit: q.maxOutlets, hint: 'Cabang tidak bisa ditambah.' },
    {
      label: 'Pengguna',
      used: q.usedUsers,
      limit: q.maxUsers,
      hint: 'Undangan baru akan ditolak. Undangan yang belum diterima ikut terhitung.',
    },
    { label: 'Produk', used: q.usedProducts, limit: q.maxProducts, hint: 'Produk baru akan ditolak.' },
    {
      label: 'Perangkat',
      used: q.usedDevices,
      limit: q.maxDevices,
      hint: 'Kasir di perangkat baru tidak bisa mulai berjualan.',
    },
  ]
}

/** null = tak terbatas, jadi tidak pernah penuh. */
export const isFull = (l: QuotaLine) => l.limit !== null && l.used >= l.limit
export const isNear = (l: QuotaLine) => l.limit !== null && !isFull(l) && l.used / l.limit >= WARN_AT

/**
 * Batas 1 menggambarkan BENTUK paket, bukan kapasitas yang hampir habis.
 *
 * Paket Starter memberi 1 outlet, dan setiap toko punya 1 outlet sejak menit
 * pertama — jadi "Outlet 1/1 penuh" benar secara fakta tapi berlaku permanen
 * untuk semua klien Starter sejak hari mereka mendaftar. Dibiarkan masuk daftar
 * peringatan, seluruh kolom itu memerah selamanya dan admin belajar
 * mengabaikannya — persis saat peringatan yang sungguhan muncul.
 *
 * Tetap ditampilkan apa adanya di panel detail (di sana admin memang sedang
 * memeriksa satu klien), hanya tidak diperlakukan sebagai alarm.
 */
export const isStructural = (l: QuotaLine) => l.limit !== null && l.limit <= 1

/** Baris yang pantas jadi peringatan: mendekati atau sudah penuh, dan bukan bentuk paket. */
export const isAlerting = (l: QuotaLine) => !isStructural(l) && (isFull(l) || isNear(l))

/** Baris paling mendesak — dipakai ringkasan satu baris di daftar klien. */
export function tightest(q: Quota): QuotaLine | null {
  const scored = quotaLines(q).filter((l) => l.limit !== null && !isStructural(l))
  if (scored.length === 0) return null
  return scored.reduce((a, b) => (b.used / b.limit! > a.used / a.limit! ? b : a))
}

export function QuotaBars({ quota }: { quota: Quota }) {
  const lines = quotaLines(quota)

  return (
    <div className="quota-list">
      {lines.map((l) => {
        const full = isFull(l)
        const near = isNear(l)
        // Batang tetap penuh (bukan >100%) kalau toko turun paket dan sudah
        // terlanjur melewati batas — angkanya yang menjelaskan, bukan batangnya.
        const pct = l.limit === null ? 0 : Math.min(100, Math.round((l.used / l.limit) * 100))

        return (
          <div className="quota-row" key={l.label}>
            <div className="quota-head">
              <span className="quota-label">{l.label}</span>
              <span className={cn('quota-num', full && 'is-full', near && 'is-near')}>
                {l.used}
                <span className="quota-max">
                  {l.limit === null ? ' / tak terbatas' : ` / ${l.limit}`}
                </span>
              </span>
            </div>

            {l.limit !== null && (
              <div className="quota-track">
                <div
                  className={cn('quota-fill', full && 'is-full', near && 'is-near')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {full && (
              <div className="quota-warn">
                <Icon name="alert" size={13} />
                <span>Sudah penuh. {l.hint}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
