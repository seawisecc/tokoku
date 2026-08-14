'use client'

import { useLayoutEffect, useRef } from 'react'

/** 1500000 → "1.500.000". Titik, bukan koma: itu pemisah ribuan Indonesia. */
export function kelompokRibuan(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Isian angka bulat dengan pemisah ribuan yang tampil SAAT DIKETIK.
 *
 * Sebelumnya harga diketik sebagai deretan digit polos dan rupiahnya cuma
 * tampil sebagai keterangan kecil di bawahnya. Untuk angka jutaan itu tidak
 * cukup: yang mengetik "1500000" tidak punya cara memeriksa apakah nolnya enam
 * atau tujuh selain menghitungnya satu per satu dengan jari, dan salah satu nol
 * pada harga jual adalah kesalahan yang baru ketahuan setelah barangnya
 * terlanjur terjual sepuluh kali lebih murah.
 *
 * Beberapa keputusan yang menentukan:
 *
 * - **`type="text"` + `inputMode="numeric"`, bukan `type="number"`.** Isian
 *   bertipe number MENOLAK menampilkan titik pemisah — browser hanya menerima
 *   nilai yang sah sebagai bilangan, jadi pemisahnya mustahil ditampilkan di
 *   sana. `inputMode` tetap memunculkan papan angka di ponsel, yang memang
 *   satu-satunya alasan `type="number"` dipakai di aplikasi kasir.
 * - **Yang dikirim ke pemanggil selalu DIGIT MENTAH**, tanpa titik. Kalau
 *   nilai bertitik ikut mengalir ke server, `Number("1.500.000")` menjadi NaN
 *   dan yang tersimpan diam-diam jadi nol — persis jenis kegagalan yang
 *   dilarang di jalur uang.
 * - **Posisi kursor dihitung ulang setiap ketikan.** Menambah titik menggeser
 *   isi teks, jadi tanpa ini kursor melompat ke ujung setiap kali angkanya
 *   melewati kelipatan ribuan, dan orang yang sedang membetulkan digit di
 *   tengah kehilangan tempatnya. Yang dipertahankan adalah JUMLAH DIGIT di
 *   sebelah kiri kursor, bukan posisi karakternya.
 */
export function NumberField({
  id,
  name,
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  invalid,
  maxDigits = 12,
  ariaLabel,
  className,
}: {
  id?: string
  /**
   * Untuk borang yang mengirim lewat FormData.
   *
   * Yang diberi `name` adalah isian TERSEMBUNYI berisi digit mentah, bukan
   * isian yang terlihat — kalau yang terlihat ikut bernama, yang terkirim ke
   * server adalah "1.500.000" dan `Number()` di sana menghasilkan NaN yang
   * diam-diam tersimpan sebagai nol.
   */
  name?: string
  /** Digit mentah tanpa pemisah, misalnya "1500000". Boleh string kosong. */
  value: string
  /** Menerima digit mentah tanpa pemisah. */
  onChange: (digits: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  invalid?: boolean
  /** Penjaga salah tempel, bukan aturan bisnis. 12 digit = ratusan miliar. */
  maxDigits?: number
  ariaLabel?: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  })

  function ubah(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const posisi = el.selectionStart ?? el.value.length
    const digitDiKiri = el.value.slice(0, posisi).replace(/\D/g, '').length

    const digits = el.value.replace(/\D/g, '').slice(0, maxDigits)
    const tampil = kelompokRibuan(digits)

    // Cari posisi karakter yang berada tepat SETELAH digit ke-`digitDiKiri`.
    let terhitung = 0
    let pos = tampil.length
    if (digitDiKiri === 0) {
      pos = 0
    } else {
      for (let i = 0; i < tampil.length; i++) {
        if (tampil[i] !== '.') terhitung++
        if (terhitung === digitDiKiri) {
          pos = i + 1
          break
        }
      }
    }

    caret.current = pos
    onChange(digits)
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <input
      ref={ref}
      id={id}
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={kelompokRibuan(value)}
      onChange={ubah}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      />
    </>
  )
}
