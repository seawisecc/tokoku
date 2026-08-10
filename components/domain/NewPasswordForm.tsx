'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePassword, type NewPasswordState } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan Kata Sandi'}
    </button>
  )
}

/** Tautannya tidak sah — jangan tampilkan form yang sudah pasti gagal. */
function LinkGagal() {
  return (
    <>
      <p className="auth-eyebrow">Tautan tidak berlaku</p>
      <h1 className="auth-title">Tautannya Kedaluwarsa</h1>
      <p className="auth-sub">
        Tautan penggantian kata sandi hanya berlaku 1 jam dan sekali pakai. Tautan ini juga akan
        ditolak kalau dibuka di perangkat atau browser yang berbeda dari tempat Anda memintanya.
      </p>
      <Link
        href="/lupa-sandi"
        className="btn btn-primary btn-block"
        style={{ textDecoration: 'none' }}
      >
        Minta Tautan Baru
      </Link>
      <Link
        href="/masuk"
        className="btn btn-ghost btn-block"
        style={{ marginTop: 10, textDecoration: 'none' }}
      >
        Kembali ke Masuk
      </Link>
    </>
  )
}

export function NewPasswordForm({ valid, email }: { valid: boolean; email: string | null }) {
  const [state, action] = useActionState<NewPasswordState, FormData>(updatePassword, {})
  // Terkendali state — lihat catatan yang sama di ForgotPasswordForm.
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  if (!valid) return <LinkGagal />

  return (
    <>
      <p className="auth-eyebrow">Langkah terakhir</p>
      <h1 className="auth-title">Kata Sandi Baru</h1>
      <p className="auth-sub">
        {email ? `Untuk akun ${email}. ` : ''}
        Setelah disimpan, Anda akan diminta masuk lagi memakai kata sandi yang baru.
      </p>

      <form action={action}>
        <div className="field">
          <label htmlFor="newPassword">Kata Sandi Baru</label>
          <input
            id="newPassword"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Ulangi Kata Sandi</label>
          <input
            id="confirmPassword"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Ketik ulang sandi yang sama"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {state.error && (
          <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{state.error}</div>
          </div>
        )}

        <Submit />
      </form>
    </>
  )
}
