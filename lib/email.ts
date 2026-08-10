import 'server-only'

/**
 * Pengiriman email transaksional.
 *
 * Lewat `fetch` langsung ke Resend, bukan SDK-nya. Yang dipakai cuma satu POST
 * JSON; menambah dependensi untuk itu berarti satu paket lagi yang harus ikut
 * diaudit dan diperbarui seumur hidup project.
 *
 * OPSIONAL SECARA SENGAJA. Tanpa `RESEND_API_KEY`, `sendEmail` mengembalikan
 * `skipped` dan pemanggilnya jatuh ke jalur salin-tautan-manual yang sudah ada.
 * Aplikasi harus tetap utuh di mesin pengembang dan di instalasi yang memang
 * tidak mau memasang penyedia email — fitur yang mati diam-diam lebih buruk
 * daripada fitur yang mengaku belum dipasang.
 *
 * Catatan operasional: penyedia yang sama sebaiknya dipasang juga sebagai custom
 * SMTP di Supabase. Email bawaan Supabase (konfirmasi pendaftaran & reset sandi)
 * dibatasi beberapa email per jam dan tidak untuk produksi.
 */

export type SendResult =
  | { status: 'sent' }
  /** Penyedia belum dipasang — bukan kegagalan, dan bukan alasan membatalkan apa pun. */
  | { status: 'skipped' }
  | { status: 'failed'; error: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail(input: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) return { status: 'skipped' }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      // Jangan menggantung server action kalau penyedianya sedang lambat.
      signal: AbortSignal.timeout(10_000),
    })

    if (res.ok) return { status: 'sent' }

    // Pesan Resend berbahasa Inggris dan menyebut istilah teknis. Yang paling
    // sering terjadi dijawab dengan kalimat yang bisa ditindaklanjuti pemilik
    // toko; sisanya diteruskan apa adanya supaya tidak ada kegagalan yang hilang.
    const body = (await res.text().catch(() => '')).slice(0, 300)
    if (res.status === 401 || res.status === 403) {
      return { status: 'failed', error: 'Kunci API email ditolak penyedia. Periksa RESEND_API_KEY.' }
    }
    if (res.status === 422) {
      return {
        status: 'failed',
        error: 'Alamat pengirim belum diverifikasi di penyedia email, atau alamat tujuan ditolak.',
      }
    }
    if (res.status === 429) {
      return { status: 'failed', error: 'Kuota kirim email penyedia sedang penuh. Coba lagi nanti.' }
    }
    return { status: 'failed', error: `Penyedia email menolak (${res.status}). ${body}` }
  } catch (e) {
    // Termasuk timeout di atas dan jaringan mati.
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'failed', error: `Email tidak terkirim: ${msg}` }
  }
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin Toko',
  cashier: 'Kasir',
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Email undangan anggota tim.
 *
 * Semua gaya ditulis inline. Klien email (terutama Gmail versi web) membuang
 * `<style>` di head dan tidak mengenal CSS variable, jadi warna brand disebut
 * apa adanya di sini — satu-satunya tempat di project ini yang boleh begitu.
 *
 * Tautan tetap ditulis sebagai teks di bawah tombol: sebagian klien email
 * memblokir tombol berwarna atau menampilkannya sebagai kotak kosong, dan
 * undangan yang tidak bisa diklik sama saja dengan tidak terkirim.
 */
export function invitationEmail(input: {
  storeName: string
  inviterName: string
  role: string
  link: string
  appName: string
}): { subject: string; html: string; text: string } {
  const role = ROLE_LABEL[input.role] ?? input.role
  const subject = `Undangan bergabung ke ${input.storeName} di ${input.appName}`

  const text = [
    `${input.inviterName} mengundang Anda bergabung ke ${input.storeName} sebagai ${role}.`,
    '',
    'Buka tautan ini untuk menerima undangan:',
    input.link,
    '',
    'Tautan ini berlaku 7 hari dan hanya bisa dipakai sekali.',
    `Kalau Anda merasa tidak mengenal ${input.storeName}, abaikan saja email ini.`,
    '',
    `— ${input.appName}`,
  ].join('\n')

  const html = `
<div style="margin:0;padding:24px 12px;background:#fafbf6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17231c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4eae2;border-radius:16px;overflow:hidden">
    <div style="padding:20px 24px;background:#0e2419;color:#a1ffce;font-size:15px;font-weight:700">
      ${esc(input.appName)}
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.5">
        <strong>${esc(input.inviterName)}</strong> mengundang Anda bergabung ke
        <strong>${esc(input.storeName)}</strong> sebagai <strong>${esc(role)}</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b6b60">
        Setelah bergabung, Anda bisa melayani penjualan di kasir sesuai akses yang diberikan
        pemilik toko — termasuk saat internet sedang mati.
      </p>
      <a href="${esc(input.link)}"
         style="display:inline-block;padding:12px 22px;background:#0e2419;color:#a1ffce;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">
        Terima Undangan
      </a>
      <p style="margin:20px 0 6px;font-size:12.5px;color:#8b9a90">
        Kalau tombolnya tidak bisa ditekan, salin tautan ini ke browser:
      </p>
      <p style="margin:0;font-size:12px;color:#5b6b60;word-break:break-all">${esc(input.link)}</p>
      <hr style="border:none;border-top:1px solid #e4eae2;margin:22px 0" />
      <p style="margin:0;font-size:12.5px;color:#8b9a90;line-height:1.6">
        Tautan ini berlaku 7 hari dan hanya bisa dipakai sekali.
        Kalau Anda merasa tidak mengenal ${esc(input.storeName)}, abaikan saja email ini —
        tanpa dibuka, undangannya tidak berlaku.
      </p>
    </div>
  </div>
</div>`.trim()

  return { subject, html, text }
}
