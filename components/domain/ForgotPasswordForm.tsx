'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { requestPasswordReset, type ResetRequestState } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? 'Mengirim…' : 'Kirim Tautan'}
    </button>
  )
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {})
  // Terkendali state: React 19 mengosongkan <form> setiap kali action selesai,
  // jadi email yang sudah diketik akan hilang tiap kali pengiriman gagal.
  const [email, setEmail] = useState('')

  return (
    <>
      <p className="auth-eyebrow">Tidak bisa masuk</p>
      <h1 className="auth-title">Lupa Kata Sandi</h1>
      <p className="auth-sub">
        Masukkan email yang Anda pakai di TokoKu. Kami kirimkan tautan untuk membuat kata sandi
        baru.
      </p>

      <form action={action}>
        <div className="field">
          <label htmlFor="resetEmail">Email</label>
          <input
            id="resetEmail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@toko.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {state.error && (
          <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{state.error}</div>
          </div>
        )}
        {state.notice && (
          <div
            className="empty-note"
            style={{
              marginBottom: 14,
              background: 'var(--color-success-soft)',
              color: 'var(--color-success)',
            }}
            role="status"
          >
            <Icon name="check" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{state.notice}</div>
          </div>
        )}

        <Submit />
      </form>

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
