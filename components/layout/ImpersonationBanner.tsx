import { stopImpersonation } from '@/app/(platform)/admin/actions'
import { Icon } from '@/components/ui/icons'

/**
 * Pita peringatan saat Super Admin sedang melihat toko klien.
 *
 * Sengaja mencolok dan tidak bisa ditutup: kalau seseorang lupa dia sedang
 * melihat data toko orang lain, dia akan salah membaca angkanya sebagai
 * angka platform.
 */
export function ImpersonationBanner({ storeName }: { storeName: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--color-amber-soft)',
        color: 'var(--color-amber-ink)',
        borderBottom: '1px solid rgba(138, 106, 0, .18)',
        fontSize: 12.5,
        fontWeight: 600,
      }}
      role="status"
    >
      <Icon name="alert" size={15} />
      <div style={{ flex: 1, minWidth: 200 }}>
        Mode Super Admin — melihat <strong>{storeName}</strong>. Hanya baca; perubahan
        apa pun akan ditolak database.
      </div>
      <form action={stopImpersonation}>
        <button
          className="btn btn-sm"
          type="submit"
          style={{ background: 'var(--color-amber-ink)', color: '#fff' }}
        >
          Keluar dari mode ini
        </button>
      </form>
    </div>
  )
}
