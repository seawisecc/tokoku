/**
 * Isi dokumen data susulan onboarding Midtrans, lalu cetak jadi PDF.
 *
 *   node scripts/isi-dokumen-midtrans.mjs
 *
 * Templat kosongnya (`Data-Susulan-Onboarding-TokoKu-Midtrans.html`) ikut
 * ter-commit; hasil isiannya TIDAK. Repo ini publik, dan yang diisi di sini
 * adalah NIK, alamat rumah, dan kata sandi akun peninjauan. Ketiganya tidak
 * boleh ada di GitHub dalam bentuk apa pun, jadi baik berkas datanya maupun
 * hasilnya masuk .gitignore.
 *
 * Dibuat sebagai skrip, bukan sekali edit tangan, karena dokumennya memang akan
 * diisi DUA KALI: sekarang untuk data pribadi, dan sekali lagi setelah akun
 * peninjauan dibuat. Diedit tangan, isian yang pertama hilang saat templatnya
 * diperbarui.
 *
 * Datanya dibaca dari `midtrans-data.local.json` di akar project. Kalau berkas
 * itu belum ada, skrip ini membuatkan contohnya lalu berhenti.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'midtrans-data.local.json')
const TEMPLAT = join(ROOT, 'Data-Susulan-Onboarding-TokoKu-Midtrans.html')
const HASIL_HTML = join(ROOT, 'Data-Susulan-Onboarding-TokoKu-Midtrans-ISI.html')
const HASIL_PDF = join(ROOT, 'Data-Susulan-Onboarding-TokoKu-Midtrans-ISI.pdf')

const CONTOH = {
  namaLengkap: '',
  nik: '',
  alamatUsaha: '',
  telepon: '',
  email: '',
  kota: '',
  tanggalDokumen: '',
  domainAtasNama: '',
  // Bagian 2 — diisi setelah toko peninjauan didaftarkan lewat /daftar-toko.
  // Biarkan kosong kalau belum ada; barisnya akan tetap jadi garis titik-titik
  // yang bisa ditulis tangan.
  akunEmail: '',
  akunSandi: '',
  akunNamaToko: '',
  akunBerlakuSampai: '',
}

if (!existsSync(DATA)) {
  writeFileSync(DATA, JSON.stringify(CONTOH, null, 2) + '\n')
  console.log(`\nBerkas data belum ada, sudah dibuatkan: ${DATA}`)
  console.log('Isi dulu, lalu jalankan skrip ini lagi.\n')
  process.exit(0)
}

const d = { ...CONTOH, ...JSON.parse(readFileSync(DATA, 'utf8')) }
const wajib = ['namaLengkap', 'nik', 'alamatUsaha', 'telepon', 'email', 'kota', 'tanggalDokumen']
const kurang = wajib.filter((k) => !String(d[k]).trim())
if (kurang.length) {
  console.error(`\n✗ Belum diisi di ${DATA}: ${kurang.join(', ')}\n`)
  process.exit(1)
}

let s = readFileSync(TEMPLAT, 'utf8')
let n = 0
const rep = (lama, baru) => {
  if (!s.includes(lama)) {
    console.error(`\n✗ Potongan templat tidak ketemu:\n  ${lama.slice(0, 90)}`)
    console.error('  Templatnya berubah. Perbarui skrip ini.\n')
    process.exit(1)
  }
  s = s.replace(lama, baru)
  n++
}
/** Isian yang boleh kosong: kalau datanya belum ada, garis titik-titiknya dipertahankan. */
const repOpsional = (lama, nilai) => {
  if (!String(nilai).trim()) return
  rep(lama, lama.replace(/<span class="isi[^"]*"><\/span>/, nilai))
}

// ── Sampul ──────────────────────────────────────────────────────────────────
rep('<tr><td>Penanggung jawab</td><td><span class="isi full"></span></td></tr>',
    `<tr><td>Penanggung jawab</td><td>${d.namaLengkap}</td></tr>`)

// ── Bagian 1 ────────────────────────────────────────────────────────────────
repOpsional('<tr><td>Terdaftar atas nama</td><td><span class="isi full"></span></td></tr>',
            d.domainAtasNama || `${d.namaLengkap} (perorangan)`)

// ── Bagian 2: kredensial akun peninjauan ────────────────────────────────────
repOpsional('<tr><td>Alamat email</td><td><span class="isi full"></span></td></tr>', d.akunEmail)
repOpsional('<tr><td>Kata sandi</td><td><span class="isi full"></span></td></tr>', d.akunSandi)
repOpsional('<tr><td>Nama toko peninjauan</td><td><span class="isi full"></span></td></tr>', d.akunNamaToko)
repOpsional('<tr><td>Berlaku sampai</td><td><span class="isi full"></span></td></tr>', d.akunBerlakuSampai)

// ── Bagian 4: data penanggung jawab ─────────────────────────────────────────
rep(`    <tr><td>Nama lengkap</td><td><span class="isi full"></span></td></tr>
    <tr><td>Jabatan</td><td><span class="isi full"></span></td></tr>
    <tr><td>Nomor identitas (KTP)</td><td><span class="isi full"></span></td></tr>
    <tr><td>Nama badan usaha</td><td><span class="isi full"></span></td></tr>
    <tr><td>Alamat usaha</td><td><span class="isi full"></span></td></tr>
    <tr><td>Nomor telepon</td><td><span class="isi full"></span></td></tr>
    <tr><td>Alamat email</td><td><span class="isi full"></span></td></tr>`,
`    <tr><td>Nama lengkap</td><td>${d.namaLengkap}</td></tr>
    <tr><td>Jabatan</td><td>Pemilik dan penanggung jawab usaha</td></tr>
    <tr><td>Nomor identitas (KTP)</td><td>${d.nik}</td></tr>
    <tr><td>Bentuk usaha</td><td>Perorangan, belum berbadan hukum. Nama dagang: Seawise Studio</td></tr>
    <tr><td>Alamat usaha</td><td>${d.alamatUsaha}</td></tr>
    <tr><td>Nomor telepon</td><td>${d.telepon}</td></tr>
    <tr><td>Alamat email</td><td>${d.email}</td></tr>`)

// ── Pernyataan: "Kami" jadi "Saya", karena penandatangannya perorangan ──────
rep('Kami tidak menampung, menyimpan, atau menyalurkan dana milik pihak lain. Yang diproses melalui Midtrans adalah pembayaran langganan aplikasi dari pemilik toko kepada kami sebagai penyedia perangkat lunak.',
    'Saya tidak menampung, menyimpan, atau menyalurkan dana milik pihak lain. Yang diproses melalui Midtrans adalah pembayaran langganan aplikasi dari pemilik toko kepada saya sebagai penyedia perangkat lunak.')
rep('Kami bersedia memberikan keterangan atau dokumen tambahan bila Midtrans memerlukannya dalam proses peninjauan.',
    'Saya bersedia memberikan keterangan atau dokumen tambahan bila Midtrans memerlukannya dalam proses peninjauan.')
rep('Akun yang diberikan pada Bagian 2 adalah akun peninjauan yang sengaja disiapkan untuk keperluan ini, dan berisi data contoh.',
    'Akun yang diberikan pada Bagian 2 adalah akun peninjauan yang sengaja saya siapkan untuk keperluan ini, dan berisi data contoh.')

// ── Blok tanda tangan ───────────────────────────────────────────────────────
rep(`      <div class="lbl">Dibuat di, tanggal</div>
      <p style="margin-top:8px"><span class="isi full"></span></p>`,
`      <div class="lbl">Dibuat di, tanggal</div>
      <p style="margin-top:8px"><b>${d.kota}, ${d.tanggalDokumen}</b></p>`)

rep(`      <div class="ttd-name">
        <b><span class="isi full"></span></b>
        <span class="isi full" style="margin-top:6px"></span>
      </div>`,
`      <div class="ttd-name">
        <b>${d.namaLengkap}</b>
        Pemilik dan penanggung jawab usaha
      </div>`)

writeFileSync(HASIL_HTML, s)

// ── Cetak jadi PDF ──────────────────────────────────────────────────────────
// Lewat Chrome headless, bukan pustaka PDF: yang dibutuhkan cuma teks di atas
// kertas, dan Chrome memang sudah ada di mesin ini. Alasan yang sama dengan
// ekspor laporan dan struk 58mm.
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (existsSync(CHROME)) {
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    '--virtual-time-budget=4000',
    `--print-to-pdf=${HASIL_PDF}`, `file://${HASIL_HTML}`,
  ], { stdio: 'ignore' })
  const pdf = readFileSync(HASIL_PDF)
  const halaman = (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length
  console.log(`\n✓ ${HASIL_PDF.replace(ROOT + '/', '')} — ${halaman} halaman`)
  if (halaman !== 5) {
    console.log(`  ⚠ Harusnya 5 halaman. Ada bagian yang meluap, periksa sebelum dikirim.`)
  }
} else {
  console.log(`\n✓ ${HASIL_HTML.replace(ROOT + '/', '')} dibuat. Chrome tidak ketemu, cetak sendiri jadi PDF.`)
}

const sisa = (s.match(/class="isi/g) ?? []).length
console.log(`  ${n} bagian diisi, ${sisa} isian masih kosong` +
  (sisa ? ' (tulis tangan setelah dicetak, atau isi di midtrans-data.local.json)' : ''))
console.log('  Yang tetap harus tangan: tanda tangan di atas materai Rp 10.000\n')
