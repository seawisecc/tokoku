'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  disableMember,
  inviteMember,
  revokeInvitation,
  updateMember,
} from '@/app/(toko)/pengaturan/actions'
import { IconAction } from '@/components/data/IconAction'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type Member = {
  id: string
  userId: string
  name: string
  initials: string
  role: 'owner' | 'admin' | 'cashier'
  permissions: Record<string, boolean>
  isSelf: boolean
}

export type Invitation = { id: string; email: string; role: string; token: string; expiresAt: string }

const ROLE_LABEL: Record<string, string> = { owner: 'Pemilik', admin: 'Admin Toko', cashier: 'Kasir' }
const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-enterprise',
  admin: 'badge-growth',
  cashier: 'badge-starter',
}
const MODULES: { key: string; label: string; hint: string }[] = [
  { key: 'pos', label: 'Kasir', hint: 'Melayani penjualan' },
  { key: 'products', label: 'Produk & Stok', hint: 'Tambah, ubah, sesuaikan stok' },
  { key: 'reports', label: 'Laporan', hint: 'Omset, laba, batalkan transaksi' },
  { key: 'settings', label: 'Pengaturan', hint: 'Toko, tim, printer' },
]

function PermissionToggles({ value }: { value: Record<string, boolean> }) {
  const [perms, setPerms] = useState(value)
  return (
    <div className="card" style={{ padding: '4px 16px' }}>
      {MODULES.map((m) => (
        <label
          key={m.key}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '11px 0',
            borderBottom: '1px solid var(--color-line)',
            cursor: 'pointer',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
            <div className="field-hint">{m.hint}</div>
          </div>
          <input
            type="checkbox"
            name={`perm_${m.key}`}
            checked={perms[m.key] ?? false}
            onChange={(e) => setPerms((p) => ({ ...p, [m.key]: e.target.checked }))}
          />
        </label>
      ))}
    </div>
  )
}

export function TeamManager({
  members,
  invitations,
  appUrl,
}: {
  members: Member[]
  invitations: Invitation[]
  appUrl: string
}) {
  const router = useRouter()
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<{
    link: string
    email: string
    delivery: 'sent' | 'skipped' | 'failed'
    deliveryError?: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  function handle(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Gagal.')
        return
      }
      setError(null)
      after?.()
      router.refresh()
    })
  }

  return (
    <>
      {error && (
        <div className="empty-note" style={{ marginBottom: 16 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      {/* Tautannya ditampilkan SELALU, termasuk saat emailnya berhasil terkirim.
          Bukan sekadar cadangan: banyak pemilik warung memang lebih suka
          mengirimnya lewat WhatsApp, dan email undangan gampang tersangkut di
          folder spam tanpa ada yang tahu. */}
      {invited && (
        <div
          className="empty-note is-ok"
          style={{
            marginBottom: 16,
            background:
              invited.delivery === 'failed' ? 'var(--color-amber-soft)' : 'var(--color-blue-soft)',
            color:
              invited.delivery === 'failed' ? 'var(--color-amber-ink)' : 'var(--color-blue-ink)',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
          role="status"
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {invited.delivery === 'sent'
              ? `Undangan terkirim ke ${invited.email}`
              : 'Undangan dibuat'}
          </div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>
            {invited.delivery === 'sent' &&
              'Minta yang bersangkutan memeriksa kotak masuk, dan folder spam. Tautannya juga bisa dikirim lewat WhatsApp:'}
            {invited.delivery === 'skipped' &&
              'Pengiriman email belum disiapkan di server ini. Salin tautan berikut dan kirim sendiri lewat WhatsApp:'}
            {invited.delivery === 'failed' && (
              <>
                Undangannya <strong>tetap berlaku</strong>, tapi emailnya gagal terkirim
                {invited.deliveryError ? `: ${invited.deliveryError}` : '.'} Kirim tautan ini
                sendiri lewat WhatsApp:
              </>
            )}
          </div>
          <code
            className="mono"
            style={{ display: 'block', background: '#fff', padding: '9px 11px', borderRadius: 8, fontSize: 11.5, wordBreak: 'break-all' }}
          >
            {invited.link}
          </code>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 0 }}>
        Anggota Aktif
        <button className="btn btn-primary btn-sm" type="button" onClick={() => setInviting(true)}>
          <Icon name="plus" size={14} /> Undang
        </button>
      </div>

      <div className="card">
        {members.map((m) => (
          <div className="team-row" key={m.id}>
            <div className="team-avatar">{m.initials}</div>
            <div className="team-info">
              <b>
                {m.name}
                {m.isSelf && <span style={{ color: 'var(--color-ink-faint)' }}> · Anda</span>}
              </b>
              <span>
                {MODULES.filter((x) => m.role === 'owner' || m.permissions[x.key])
                  .map((x) => x.label)
                  .join(', ') || 'Belum ada akses modul'}
              </span>
            </div>
            <span className={cn('badge', ROLE_BADGE[m.role])}>{ROLE_LABEL[m.role]}</span>
            <div className="row-actions">
              <IconAction icon="edit" label="Ubah akses" onClick={() => setEditing(m)} />
              {!m.isSelf && (
                <IconAction
                  icon="trash"
                  label="Nonaktifkan"
                  danger
                  confirm
                  onClick={() => handle(() => disableMember(m.id))}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <>
          <div className="section-title">Undangan Menunggu</div>
          <div className="card">
            {invitations.map((inv) => (
              <div className="team-row" key={inv.id}>
                <div className="team-avatar">
                  <Icon name="login" size={15} />
                </div>
                <div className="team-info">
                  <b>{inv.email}</b>
                  <span>
                    {ROLE_LABEL[inv.role] ?? inv.role} · kedaluwarsa{' '}
                    {new Date(inv.expiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="row-actions">
                  <IconAction
                    icon="x"
                    label="Batalkan undangan"
                    danger
                    confirm
                    onClick={() => handle(() => revokeInvitation(inv.id))}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {inviting && (
        <Drawer
          open
          title="Undang Anggota Tim"
          onClose={() => setInviting(false)}
          footer={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setInviting(false)}>
                Batal
              </button>
              <button className="btn btn-dark" type="submit" form="invite-form" disabled={pending}>
                {pending ? 'Mengirim…' : 'Buat Undangan'}
              </button>
            </>
          }
        >
          <form
            id="invite-form"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              startTransition(async () => {
                const res = await inviteMember(fd)
                if (!res.ok) {
                  setError(res.error)
                  return
                }
                setError(null)
                setInviting(false)
                setInvited({
                  link: `${appUrl}/undangan/${res.token}`,
                  email: res.email,
                  delivery: res.delivery,
                  deliveryError: res.deliveryError,
                })
                router.refresh()
              })
            }}
          >
            <div className="field">
              <label htmlFor="inviteEmail">Email</label>
              <input id="inviteEmail" name="email" type="email" required placeholder="nama@email.com" />
            </div>
            <div className="field">
              <label htmlFor="inviteRole">Peran</label>
              <select id="inviteRole" name="role" defaultValue="cashier">
                <option value="cashier">Kasir</option>
                <option value="admin">Admin Toko</option>
                <option value="owner">Pemilik</option>
              </select>
            </div>
            <div className="section-title">Akses Modul</div>
            <PermissionToggles value={{ pos: true, products: false, reports: false, settings: false }} />
          </form>
        </Drawer>
      )}

      {editing && (
        <Drawer
          open
          key={editing.id}
          title="Ubah Akses"
          subtitle={editing.name}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button className="btn btn-dark" type="submit" form="member-form" disabled={pending}>
                {pending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          }
        >
          <form
            id="member-form"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              handle(() => updateMember(editing.id, fd), () => setEditing(null))
            }}
          >
            <div className="field">
              <label htmlFor="memberRole">Peran</label>
              <select id="memberRole" name="role" defaultValue={editing.role}>
                <option value="cashier">Kasir</option>
                <option value="admin">Admin Toko</option>
                <option value="owner">Pemilik</option>
              </select>
              <div className="field-hint">Pemilik selalu punya akses penuh, apa pun sakelarnya.</div>
            </div>
            <div className="section-title">Akses Modul</div>
            <PermissionToggles value={editing.permissions} />
          </form>
        </Drawer>
      )}
    </>
  )
}
