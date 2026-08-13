/**
 * Baca-tulis CSV.
 *
 * Ditulis sendiri, tanpa dependensi. Yang dibutuhkan aplikasi ini cuma satu
 * tabel datar tanpa tipe bersarang, dan pustaka CSV yang lengkap membawa
 * puluhan kilobyte ke bundel kasir untuk kemampuan yang tidak pernah dipakai.
 */

/** Bungkus satu sel supaya tanda baca di dalamnya tidak memecah kolom. */
function sel(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // Baris baru dan tanda kutip WAJIB dikutip; koma jelas. Titik koma ikut
  // dikutip karena berkasnya sering dibuka di Excel berlokal Indonesia, yang
  // memakai titik koma sebagai pemisah kolom.
  return /["\n\r,;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/**
 * Susun CSV siap unduh.
 *
 * Diawali BOM UTF-8. Tanpa itu Excel di Windows membaca berkasnya sebagai
 * ANSI, dan setiap nama barang berhuruf beraksen atau bertanda rupiah tampil
 * sebagai simbol acak — pemilik toko menyimpulkan backup-nya rusak.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const isi = [headers.map(sel).join(','), ...rows.map((r) => r.map(sel).join(','))]
  return '﻿' + isi.join('\r\n') + '\r\n'
}

/**
 * Pisah satu berkas CSV jadi baris dan kolom.
 *
 * Menangani sel berkutip, koma dan baris baru di dalam kutip, akhiran baris
 * CRLF maupun LF, dan BOM di depan berkas.
 *
 * Pemisah kolomnya DIDETEKSI, tidak dipatok koma. Excel berlokal Indonesia
 * menyimpan CSV dengan titik koma, dan itu justru bentuk yang paling sering
 * sampai ke tangan kita: berkasnya dibuat pemilik toko sendiri di laptopnya.
 * Dipatok koma, seluruh barisnya terbaca sebagai satu kolom raksasa dan
 * pesannya berbunyi "kolom SKU tidak ditemukan" — yang membuat orang mengira
 * berkasnya salah, padahal cuma pemisahnya.
 */
export function parseCsv(text: string): string[][] {
  const bersih = text.replace(/^﻿/, '')
  const barisPertama = bersih.split(/\r?\n/, 1)[0] ?? ''
  const pemisah =
    (barisPertama.match(/;/g) ?? []).length > (barisPertama.match(/,/g) ?? []).length ? ';' : ','

  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let dalamKutip = false

  for (let i = 0; i < bersih.length; i++) {
    const c = bersih[i]

    if (dalamKutip) {
      if (c === '"') {
        // Dua kutip berturut-turut berarti satu kutip literal, bukan penutup.
        if (bersih[i + 1] === '"') {
          sel += '"'
          i++
        } else {
          dalamKutip = false
        }
      } else {
        sel += c
      }
      continue
    }

    if (c === '"') {
      dalamKutip = true
    } else if (c === pemisah) {
      baris.push(sel)
      sel = ''
    } else if (c === '\n') {
      baris.push(sel)
      hasil.push(baris)
      baris = []
      sel = ''
    } else if (c === '\r') {
      // Bagian dari CRLF; \n berikutnya yang menutup barisnya.
    } else {
      sel += c
    }
  }

  // Sel terakhir tidak diakhiri baris baru kalau berkasnya berakhir mendadak.
  if (sel !== '' || baris.length > 0) {
    baris.push(sel)
    hasil.push(baris)
  }

  // Baris kosong dibuang. Spreadsheet gemar meninggalkan puluhan baris kosong
  // di bawah data, dan tanpa ini semuanya terbaca sebagai "SKU kosong".
  return hasil.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Cocokkan nama kolom yang ditulis manusia ke nama kolom yang kita pakai.
 *
 * Sengaja longgar. Berkasnya datang dari spreadsheet pemilik toko, dan di sana
 * kolomnya bernama "Harga Jual", "harga_jual", atau "HARGA JUAL" tergantung
 * siapa yang mengetik. Menolak berkas karena judul kolomnya beda spasi adalah
 * cara tercepat membuat orang menyerah pada langkah pertama.
 */
export function normalkanHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim()
}
