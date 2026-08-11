'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn, signUp, type LoginState, type SignUpState } from '@/app/(auth)/actions'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

function Submit({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
      {pending ? busyLabel : label}
    </button>
  )
}

function Alert({ tone, children }: { tone: 'bad' | 'ok'; children: React.ReactNode }) {
  return (
    <div
      className="empty-note"
      style={
        tone === 'ok'
          ? { marginBottom: 14, background: 'var(--color-success-soft)', color: 'var(--color-success)' }
          : { marginBottom: 14 }
      }
      role="alert"
    >
      <Icon name={tone === 'ok' ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

/**
 * Panel masuk / daftar dengan tepi miring yang berayun.
 *
 * Kedua form selalu ada di DOM — yang tidak aktif diberi `pointer-events: none`
 * dan `aria-hidden`, bukan dilepas. Melepasnya akan memutus animasi keluar dan
 * membuat isian hilang saat user bolak-balik antar tab.
 */
export function AuthPanel({
  initialMode = 'login',
  notice,
}: {
  initialMode?: 'login' | 'register'
  /** Kabar dari alur lain yang berakhir di sini — mis. kata sandi baru tersimpan. */
  notice?: string
}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [loginState, loginAction] = useActionState<LoginState, FormData>(signIn, {})
  const [signUpState, signUpAction] = useActionState<SignUpState, FormData>(signUp, {})

  // Kalau salah satu form melaporkan error, pastikan form itulah yang terlihat.
  useEffect(() => {
    if (signUpState.error || signUpState.notice) setMode('register')
  }, [signUpState])
  useEffect(() => {
    if (loginState.error) setMode('login')
  }, [loginState])

  const isRegister = mode === 'register'

  return (
    <div className="auth-shell">
      <div className={cn('auth-container', isRegister && 'active')}>
        <div className="auth-forms">
          {/* ---------------- masuk ---------------- */}
          <section className="form-panel form-panel--login" aria-hidden={isRegister}>
            <p className="auth-eyebrow">Selamat datang kembali</p>
            <h1 className="auth-title">Masuk</h1>
            <p className="auth-sub">Kelola toko, kasir, dan laporan dari satu tempat.</p>

            {notice && <Alert tone="ok">{notice}</Alert>}

            <form action={loginAction}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@toko.id"
                  tabIndex={isRegister ? -1 : 0}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">Kata Sandi</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  tabIndex={isRegister ? -1 : 0}
                  required
                />
              </div>

              <p className="auth-help">
                <Link href="/lupa-sandi" tabIndex={isRegister ? -1 : 0}>
                  Lupa kata sandi?
                </Link>
              </p>

              {loginState.error && <Alert tone="bad">{loginState.error}</Alert>}
              <Submit label="Masuk" busyLabel="Memproses…" />
            </form>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              onClick={() => setMode('register')}
              tabIndex={isRegister ? -1 : 0}
            >
              Belum punya toko? Daftar
            </button>
          </section>

          {/* ---------------- daftar ---------------- */}
          <section className="form-panel form-panel--register" aria-hidden={!isRegister}>
            <p className="auth-eyebrow">Mulai gratis</p>
            <h1 className="auth-title">Daftarkan Toko</h1>
            <p className="auth-sub">Siap dipakai jualan dalam hitungan menit.</p>

            <form action={signUpAction}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="storeName">Nama Toko</label>
                  <input
                    id="storeName"
                    name="storeName"
                    placeholder="Toko Dewi"
                    tabIndex={isRegister ? 0 : -1}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="city">Kota</label>
                  <input id="city" name="city" placeholder="Denpasar" tabIndex={isRegister ? 0 : -1} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="fullName">Nama Anda</label>
                <input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Rina Kartika"
                  tabIndex={isRegister ? 0 : -1}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="regEmail">Email</label>
                <input
                  id="regEmail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@toko.id"
                  tabIndex={isRegister ? 0 : -1}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="regPassword">Kata Sandi</label>
                <input
                  id="regPassword"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  tabIndex={isRegister ? 0 : -1}
                  required
                />
              </div>

              {signUpState.error && <Alert tone="bad">{signUpState.error}</Alert>}
              {signUpState.notice && <Alert tone="ok">{signUpState.notice}</Alert>}
              <Submit label="Daftarkan Toko" busyLabel="Menyiapkan toko…" />
            </form>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              onClick={() => setMode('login')}
              tabIndex={isRegister ? 0 : -1}
            >
              Sudah punya akun? Masuk
            </button>
          </section>
        </div>

        {/* ---------------- panel gradient ---------------- */}
        <aside className="overlay-panel">
          <div className="overlay-inner">
            {isRegister ? (
              <>
                <h2 className="overlay-title">Sudah punya toko?</h2>
                <p className="overlay-text">
                  Masuk untuk melanjutkan berjualan. Semua data toko Anda menunggu di dalam.
                </p>
                <button type="button" className="btn-outline-forest" onClick={() => setMode('login')}>
                  Masuk
                </button>
              </>
            ) : (
              <>
                <h2 className="overlay-title">Baru di TokoKu?</h2>
                <p className="overlay-text">
                  Daftarkan toko Anda dan mulai mencatat penjualan, bahkan saat internet mati.
                </p>
                <button type="button" className="btn-outline-forest" onClick={() => setMode('register')}>
                  Daftarkan Toko
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
