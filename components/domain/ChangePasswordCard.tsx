'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { changePassword, type ChangePasswordState } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'
import { PasswordField } from '@/components/ui/PasswordField'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-dark" type="submit" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Ganti Kata Sandi'}
    </button>
  )
}

/**
 * Ganti kata sandi tanpa keluar dari aplikasi.
 *
 * Sampai hari ini satu-satunya cara mengganti sandi adalah lewat "Lupa kata
 * sandi" di halaman masuk — yang berarti harus keluar dulu, lalu menunggu email
 * yang bisa saja tersangkut di spam. Untuk sesuatu yang seharusnya dikerjakan
 * rutin (dan yang paling mendesak: mengganti sandi bawaan setelah akun
 * diserahkan ke pemiliknya), itu terlalu jauh — jadi tidak ada yang pernah
 * melakukannya.
 *
 * Dipakai dua tempat dengan komponen yang SAMA: Profil di sisi toko dan
 * Pengaturan di sisi Super Admin. Disalin dua kali, salah satunya akan
 * ketinggalan saat aturan sandinya berubah.
 */
export function ChangePasswordCard() {
  const [state, action] = useActionState<ChangePasswordState, FormData>(changePassword, {})
  const [buka, setBuka] = useState(false)

  /**
   * Terkendali state, semuanya.
   *
   * React 19 me-reset `<form>` setelah `action` selesai, jadi isian
   * ber-`defaultValue` akan kosong setiap kali validasi gagal — orangnya harus
   * mengetik ulang ketiga kotaknya hanya karena salah ketik di satu kotak.
   */
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const sukses = Boolean(state.notice)

  /**
   * Berhasil: kosongkan kotaknya dan tutup formnya.
   *
   * Bergantung pada IDENTITAS `state`, bukan isi pesannya: `useActionState`
   * mengembalikan objek baru tiap kali aksinya jalan, sedangkan kalimat
   * suksesnya selalu sama persis. Kalau yang dipantau kalimatnya, penggantian
   * sandi KEDUA tidak akan membersihkan apa pun — dan sandi barunya tertinggal
   * terbaca di layar kasir yang dipakai bergantian.
   */
  useEffect(() => {
    if (!state.notice) return
    setCurrent('')
    setPassword('')
    setConfirm('')
    setBuka(false)
  }, [state])

  return (
    <div className="card form-narrow">
      <div className="cp-head" style={{ marginBottom: buka || sukses ? 14 : 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Kata sandi</div>
          <div className="cell-sub">Ganti secara berkala, terutama di perangkat bersama.</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setBuka((v) => !v)}
          aria-expanded={buka}
        >
          {buka ? 'Tutup' : 'Ganti'}
        </button>
      </div>

      {sukses && (
        <div className="empty-note is-ok" style={{ marginBottom: buka ? 14 : 0 }} role="status">
          <Icon name="check" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{state.notice}</div>
        </div>
      )}

      {buka && (
        <form action={action} className="form-narrow">
          <PasswordField
            id="cpCurrent"
            name="current"
            label="Kata sandi sekarang"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            required
          />
          <PasswordField
            id="cpNew"
            name="password"
            label="Kata sandi baru"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            minLength={8}
            value={password}
            onChange={setPassword}
            required
          />
          <PasswordField
            id="cpConfirm"
            name="confirm"
            label="Ulangi kata sandi baru"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            required
          />

          {state.error && (
            <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>{state.error}</div>
            </div>
          )}

          <Submit />
        </form>
      )}
    </div>
  )
}
