import Link from 'next/link'
import { Icon } from '@/components/ui/icons'
import { isFull, isNear, tightest, type Quota } from '@/components/domain/QuotaBars'
import { cn } from '@/lib/format'

type Client = {
  id: string | null
  name: string | null
  city: string | null
  status: string | null
  plan_code: string | null
  plan_name: string | null
  outlet_count: number | null
  user_count: number | null
}

const PLAN_BADGE: Record<string, string> = {
  starter: 'badge-starter',
  growth: 'badge-growth',
  enterprise: 'badge-enterprise',
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'badge-active' },
  trial: { label: 'Trial', cls: 'badge-trial' },
  suspended: { label: 'Ditangguhkan', cls: 'badge-inactive' },
  inactive: { label: 'Nonaktif', cls: 'badge-inactive' },
}

export function ClientRow({
  client,
  joined,
  full = false,
  quota,
}: {
  client: Client
  joined: string
  /** true = tampilkan kolom outlet & user (tabel penuh di /admin/klien). */
  full?: boolean
  /** Kuota klien ini; hanya dipakai di tabel penuh. */
  quota?: Quota | null
}) {
  const status = STATUS[client.status ?? ''] ?? { label: client.status ?? '-', cls: 'badge-ok' }
  // Yang ditampilkan cuma batas paling mendesak. Empat batang di setiap baris
  // membuat tabelnya tidak terbaca; yang perlu langsung terlihat adalah siapa
  // yang sedang mentok, bukan angka lengkap semua klien.
  const tight = quota ? tightest(quota) : null

  return (
    <tr>
      <td>
        <div className="row-flex">
          <Icon name="store" size={18} style={{ color: 'var(--color-ink-faint)' }} />
          <div>
            <Link href={`/admin/klien/${client.id}`} className="cell-name">
              {client.name}
            </Link>
            <div className="cell-sub">{client.city ?? '-'}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={cn('badge', PLAN_BADGE[client.plan_code ?? ''] ?? 'badge-ok')}>
          {client.plan_name ?? '-'}
        </span>
      </td>
      {full && <td>{client.outlet_count ?? 0}</td>}
      {full && <td>{client.user_count ?? 0}</td>}
      {full && (
        <td>
          {tight ? (
            <span className="quota-chip" title={`${tight.label}: ${tight.used} dari ${tight.limit}`}>
              <span className="quota-track">
                <span
                  className={cn('quota-fill', isFull(tight) && 'is-full', isNear(tight) && 'is-near')}
                  style={{ width: `${Math.min(100, Math.round((tight.used / tight.limit!) * 100))}%`, display: 'block', height: '100%' }}
                />
              </span>
              <span className={cn(isFull(tight) && 'quota-num is-full', isNear(tight) && 'quota-num is-near')}>
                {tight.label} {tight.used}/{tight.limit}
              </span>
            </span>
          ) : (
            <span style={{ color: 'var(--color-ink-faint)', fontSize: 12 }}>
              {quota ? 'Tak terbatas' : '-'}
            </span>
          )}
        </td>
      )}
      <td>
        <span className={cn('badge', status.cls)}>{status.label}</span>
      </td>
      <td style={{ color: 'var(--color-ink-faint)', whiteSpace: 'nowrap' }}>{joined}</td>
    </tr>
  )
}
