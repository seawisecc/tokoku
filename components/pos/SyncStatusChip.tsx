'use client'

import { Icon } from '@/components/ui/icons'

function sinceText(iso: string | null): string {
  if (!iso) return 'belum pernah'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

/**
 * Status koneksi & antrean.
 *
 * Selalu terlihat, bukan hanya saat bermasalah: offline yang senyap membuat
 * kasir tidak percaya pada aplikasinya.
 */
export function SyncStatusChip({
  online,
  pending,
  lastSync,
  onSync,
}: {
  online: boolean
  pending: number
  lastSync: string | null
  onSync: () => void
}) {
  const tone = !online ? 'var(--color-amber-ink)' : pending > 0 ? 'var(--color-blue-ink)' : 'var(--color-success)'
  const bg = !online ? 'var(--color-amber-soft)' : pending > 0 ? 'var(--color-blue-soft)' : 'var(--color-success-soft)'

  return (
    <button
      type="button"
      onClick={onSync}
      title="Kirim antrean sekarang"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 'none',
        borderRadius: 999,
        padding: '7px 12px',
        background: bg,
        color: tone,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {online ? (
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone }} />
      ) : (
        <Icon name="wifiOff" size={13} />
      )}
      {!online
        ? `Offline${pending ? ` · ${pending} antre` : ''}`
        : pending > 0
          ? `Mengirim ${pending}…`
          : `Tersinkron ${sinceText(lastSync)}`}
    </button>
  )
}
