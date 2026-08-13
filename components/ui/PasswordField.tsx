'use client'

import { useId, useState } from 'react'
import { Icon } from './icons'

/**
 * Isian kata sandi dengan tombol lihat/sembunyi.
 *
 * Alasannya bukan kenyamanan. Sandi yang tersensor total membuat orang tidak
 * punya cara memeriksa apa yang barusan diketiknya, dan di aplikasi ini
 * akibatnya menumpuk: pemilik warung mengetik di ponsel dengan papan ketik
 * yang gemar mengoreksi sendiri, lalu ditolak "email atau kata sandi salah"
 * tanpa tahu huruf mana yang meleset. Pada layar BUAT sandi (daftar, undangan,
 * ganti sandi) salah ketik yang tidak terlihat jauh lebih mahal lagi — sandinya
 * tersimpan sesuai yang salah, dan orangnya baru sadar besok pagi saat tidak
 * bisa masuk.
 *
 * Bawaannya tetap tersembunyi. Yang berubah cuma: sekarang ADA jalan untuk
 * memeriksa, dan keputusannya di tangan orang yang sedang mengetik — dia yang
 * tahu ada orang lain di belakangnya atau tidak.
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  minLength,
  required,
  autoFocus,
  tabIndex,
  hint,
}: {
  id?: string
  name: string
  label: string
  /**
   * Terkendali kalau `value` diisi. Dibiarkan opsional demi `AuthPanel`, yang
   * kedua panelnya dirender bersamaan untuk animasi geser dan mengandalkan
   * isian tak terkendali. Jangan mencampur keduanya di satu isian — React
   * memperingatkan, dan isiannya berhenti bisa diketik.
   */
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  autoComplete?: 'current-password' | 'new-password'
  minLength?: number
  required?: boolean
  autoFocus?: boolean
  /** Panel yang sedang tersembunyi di AuthPanel dikeluarkan dari urutan tab. */
  tabIndex?: number
  hint?: string
}) {
  const auto = useId()
  const inputId = id ?? auto
  const [lihat, setLihat] = useState(false)

  const kendali =
    value === undefined ? {} : { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="pwd-wrap">
        <input
          id={inputId}
          name={name}
          type={lihat ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          {...kendali}
        />
        <button
          type="button"
          className="pwd-toggle"
          onClick={() => setLihat((v) => !v)}
          /* `aria-pressed` DAN label yang berubah: pembaca layar mengumumkan
             keadaan tombolnya, sementara label yang berubah dipakai tooltip
             untuk yang memakai mouse. */
          aria-pressed={lihat}
          aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          title={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          /* Jangan ikut urutan tab. Orang yang mengetik sandi lalu menekan Tab
             hampir selalu menuju isian berikutnya atau tombol simpan; tombol
             ini menyela di tengah dan membuat Enter menekan hal yang salah.
             Pembaca layar tetap menemukannya lewat navigasi elemen. */
          tabIndex={-1}
        >
          <Icon name={lihat ? 'eyeOff' : 'eye'} size={16} />
        </button>
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
