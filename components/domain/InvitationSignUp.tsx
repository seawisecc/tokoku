'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signUpForInvitation, type InviteSignUpState } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'
import { PasswordField } from '@/components/ui/PasswordField'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? 'Membuat akun…' : 'Buat Akun & Gabung'}
    </button>
  )
}

/**
 * Dua jalan masuk untuk penerima undangan yang belum login.
 *
 * Sebelumnya halaman undangan cuma punya tombol "Masuk" — dan itu buntu untuk
 * justru orang yang paling mungkin membukanya: kasir baru yang belum pernah
 * punya akun. Dia menekan Masuk, mendarat di layar yang meminta email dan
 * sandi yang tidak pernah dia punya, lalu berhenti di situ. Satu-satunya jalan
 * keluar adalah mendaftar lewat halaman depan, yang justru membuatkan dia toko
 * SENDIRI dan bukan menggabungkannya ke toko yang mengundang.
 *
 * Yang punya akun tetap dilayani lebih dulu (tombol Masuk di atas), karena
 * mereka cuma butuh satu ketukan.
 */
export function InvitationSignUp({
  token,
  email,
  storeName,
  roleLabel,
}: {
  token: string
  /** Email yang diundang. Dikunci: undangannya melekat pada alamat ini. */
  email: string
  storeName: string
  roleLabel: string
}) {
  const [state, action] = useActionState<InviteSignUpState, FormData>(signUpForInvitation, {})
  const [buatAkun, setBuatAkun] = useState(false)

  // Terkendali state: React 19 me-reset form setelah action selesai, jadi
  // `defaultValue` akan hilang tiap kali validasi gagal.
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')

  if (state.notice) {
    return (
      <div className="empty-note is-ok" role="status">
        <Icon name="check" size={16} style={{ marginTop: 1 }} />
        <div style={{ flex: 1 }}>{state.notice}</div>
      </div>
    )
  }

  return (
    <>
      {/* Judulnya memakai kelas auth yang sama dengan Masuk dan Lupa Sandi.
          Dulu ukurannya ditulis inline dan lebih kecil, jadi halaman undangan
          terbaca seperti bagian dari halaman lain, bukan langkah tersendiri. */}
      <p className="auth-eyebrow">Undangan</p>
      <h1 className="auth-title">Bergabung dengan {storeName}</h1>
      <p className="auth-sub">
        Anda diundang sebagai <strong style={{ color: 'var(--color-ink)' }}>{roleLabel}</strong>{' '}
        untuk <strong style={{ color: 'var(--color-ink)' }}>{email}</strong>.
      </p>

      {!buatAkun ? (
        <>
          <Link href="/masuk" className="btn btn-ghost btn-block" style={{ textDecoration: 'none' }}>
            Saya sudah punya akun
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 10 }}
            onClick={() => setBuatAkun(true)}
          >
            Belum punya akun, buatkan
          </button>
        </>
      ) : (
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          {/* Email dikunci ke alamat yang diundang. Dibiarkan bisa diubah,
              orangnya membuat akun dengan email lain lalu bingung kenapa
              undangannya "hilang" — padahal undangannya menunggu di alamat
              yang satunya. */}
          <input type="hidden" name="email" value={email} />

          <div className="field">
            <label htmlFor="invEmail">Email</label>
            <input id="invEmail" value={email} readOnly disabled />
            <div className="field-hint">Undangan ini dikirim ke alamat tersebut.</div>
          </div>

          <div className="field">
            <label htmlFor="invNama">Nama Lengkap</label>
            <input
              id="invNama"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama yang tampil di struk dan laporan"
              autoFocus
              required
            />
          </div>

          <PasswordField
            id="invSandi"
            name="password"
            label="Buat Kata Sandi"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            minLength={8}
            value={password}
            onChange={setPassword}
            required
          />

          {state.error && (
            <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>{state.error}</div>
            </div>
          )}

          <Submit />
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={() => setBuatAkun(false)}
          >
            Kembali
          </button>
        </form>
      )}
    </>
  )
}
