import 'server-only'

import { createHash } from 'node:crypto'

/**
 * Pembayaran langganan lewat Midtrans Snap.
 *
 * Lewat `fetch` langsung, bukan SDK `midtrans-client`. Yang dipakai cuma dua
 * endpoint (minta token, tanya status) dan satu pemeriksaan SHA512; satu
 * dependensi lagi berarti satu paket lagi yang harus ikut diaudit seumur hidup
 * project. Alasan yang sama dengan `lib/email.ts` dan dengan tidak dipakainya
 * pustaka PDF di ekspor laporan.
 *
 * OPSIONAL SECARA SENGAJA, mengikuti pola `lib/email.ts`. Tanpa
 * `MIDTRANS_SERVER_KEY`, `midtransConfigured()` menjawab false dan halaman
 * Langganan menyembunyikan tombol bayar lalu jatuh ke jalur WhatsApp admin yang
 * memang sudah ada. Aplikasi harus tetap utuh di mesin pengembang dan di
 * instalasi yang belum punya akun Midtrans — tombol bayar yang terlihat lalu
 * gagal saat ditekan adalah cacat yang sudah pernah terjadi di sini.
 *
 * ---------------------------------------------------------------------------
 * SANDBOX vs PRODUCTION
 *
 * `MIDTRANS_IS_PRODUCTION` yang menentukan, bukan `NODE_ENV`. Keduanya sengaja
 * dipisah: selama peninjauan merchant berlangsung, aplikasi produksi memang
 * harus berjalan dengan kunci Sandbox supaya tim Midtrans bisa menyelesaikan
 * tes transaksi di alamat yang sesungguhnya. Diikat ke `NODE_ENV`, keadaan itu
 * mustahil dan satu-satunya jalan adalah menipu build.
 */

export type SnapOrder = {
  orderId: string
  amount: number
  months: number
  planName: string
  storeName: string
  customerName: string
  customerEmail: string
}

export type SnapResult =
  | { ok: true; token: string; redirectUrl: string }
  | { ok: false; error: string }

export type MidtransNotification = Record<string, unknown> & {
  order_id?: string
  status_code?: string
  gross_amount?: string
  signature_key?: string
  transaction_status?: string
  fraud_status?: string
  transaction_id?: string
  payment_type?: string
}

const isProduction = () => process.env.MIDTRANS_IS_PRODUCTION === 'true'

const snapBase = () =>
  isProduction() ? 'https://app.midtrans.com/snap/v1' : 'https://app.sandbox.midtrans.com/snap/v1'

const apiBase = () =>
  isProduction() ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2'

export function midtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY)
}

/** Untuk dipajang di layar: pemilik toko berhak tahu ini uang sungguhan atau bukan. */
export function midtransMode(): 'production' | 'sandbox' {
  return isProduction() ? 'production' : 'sandbox'
}

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY
  if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diisi')
  return key
}

/** Basic auth Midtrans: server key sebagai username, sandi kosong. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${serverKey()}:`).toString('base64')}`
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://tokoku.seawise.id').replace(/\/+$/, '')
}

/**
 * Batas waktu bayar satu tagihan.
 *
 * 24 jam, bukan satu atau dua jam. Virtual account adalah metode yang paling
 * banyak dipakai pemilik warung, dan ia sering dibayar besok pagi di ATM atau
 * lewat mobile banking setelah toko tutup. Batas yang pendek membuat nomor VA
 * mati sebelum sempat dipakai, dan orangnya menyimpulkan pembayarannya gagal.
 */
const KADALUARSA_JAM = 24

export function snapExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + KADALUARSA_JAM * 3600_000)
}

/**
 * Minta token halaman pembayaran.
 *
 * `gross_amount` di sini SELALU berasal dari tagihan yang sudah tersimpan, yang
 * nominalnya dihitung database dari `plans.price_monthly` (lihat migrasi 0047).
 * Jangan pernah meneruskan angka yang datang dari peramban ke fungsi ini.
 */
export async function snapCreateTransaction(order: SnapOrder): Promise<SnapResult> {
  if (!midtransConfigured()) return { ok: false, error: 'Pembayaran online belum diaktifkan.' }

  const kembali = `${appUrl()}/pengaturan/langganan`

  try {
    const res = await fetch(`${snapBase()}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: order.orderId,
          gross_amount: order.amount,
        },
        item_details: [
          {
            id: 'langganan',
            // Nama barang ikut tampil di halaman pembayaran dan di email bukti
            // bayar Midtrans. Disebut lengkap supaya pemilik toko bisa
            // mencocokkannya tanpa membuka aplikasi.
            name: `Langganan ${order.planName} ${order.months} bulan`.slice(0, 50),
            price: order.amount,
            quantity: 1,
          },
        ],
        customer_details: {
          first_name: order.customerName.slice(0, 50),
          email: order.customerEmail,
        },
        // Midtrans memakai zona WIB untuk `start_time`, dan formatnya kaku.
        expiry: { unit: 'hour', duration: KADALUARSA_JAM },
        /**
         * Hanya `finish` yang bisa dikirim per transaksi. Alamat untuk yang
         * ditutup di tengah (unfinish) dan yang gagal (error) hanya bisa
         * disetel di dashboard Midtrans, dan memang sudah didaftarkan ke
         * /pengaturan/langganan?status=tertunda dan ?status=gagal.
         *
         * Ketiganya cuma menentukan halaman mana yang dibuka pengguna. Sumber
         * kebenaran statusnya tetap pemberitahuan server ke server, karena
         * pengguna bisa menutup peramban tepat setelah membayar.
         */
        callbacks: { finish: `${kembali}?status=berhasil` },
        page_expiry: { duration: KADALUARSA_JAM, unit: 'hours' },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const body = (await res.json().catch(() => null)) as
      | { token?: string; redirect_url?: string; error_messages?: string[] }
      | null

    if (!res.ok || !body?.token || !body?.redirect_url) {
      // Pesan Midtrans berbahasa Inggris dan menyebut istilah teknis. Yang
      // paling sering terjadi dijawab dengan kalimat yang bisa ditindaklanjuti;
      // sisanya diteruskan apa adanya supaya tidak ada kegagalan yang hilang.
      const detail = body?.error_messages?.join(', ') ?? `HTTP ${res.status}`
      if (res.status === 401) {
        return { ok: false, error: 'Kunci Midtrans ditolak. Periksa MIDTRANS_SERVER_KEY.' }
      }
      if (res.status === 406) {
        return {
          ok: false,
          error: 'Nomor tagihan ini sudah pernah dipakai di Midtrans. Muat ulang halaman lalu coba lagi.',
        }
      }
      return { ok: false, error: `Midtrans menolak permintaan pembayaran. ${detail}` }
    }

    return { ok: true, token: body.token, redirectUrl: body.redirect_url }
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: `Tidak bisa menghubungi Midtrans. Periksa koneksi lalu coba lagi. (${pesan})`,
    }
  }
}

/**
 * Periksa keaslian pemberitahuan.
 *
 * SHA512 dari order_id + status_code + gross_amount + server key, persis urutan
 * itu tanpa pemisah apa pun. Ini SATU-SATUNYA yang membedakan pemberitahuan
 * resmi Midtrans dari permintaan POST yang diketik siapa saja ke alamat yang
 * memang terbuka untuk umum. Tanpa pemeriksaan ini, siapa pun yang tahu nomor
 * pesanan bisa mengaktifkan langganan tanpa membayar.
 *
 * Dibandingkan secara waktu-tetap. Perbandingan string biasa berhenti di
 * karakter pertama yang berbeda, dan selisih waktunya bisa dipakai menebak
 * tanda tangan satu karakter demi satu karakter.
 */
export function verifyNotificationSignature(n: MidtransNotification): boolean {
  const diterima = String(n.signature_key ?? '')
  if (!diterima) return false

  const bahan = `${n.order_id ?? ''}${n.status_code ?? ''}${n.gross_amount ?? ''}${serverKey()}`
  const dihitung = createHash('sha512').update(bahan).digest('hex')

  if (dihitung.length !== diterima.length) return false
  let beda = 0
  for (let i = 0; i < dihitung.length; i++) {
    beda |= dihitung.charCodeAt(i) ^ diterima.charCodeAt(i)
  }
  return beda === 0
}

/**
 * Tanya status satu transaksi langsung ke Midtrans.
 *
 * Dipakai jalur penyelarasan: halaman Langganan yang dibuka dengan tagihan
 * masih menunggu bertanya sendiri alih-alih menunggu pemberitahuan yang mungkin
 * tidak pernah sampai. Satu webhook yang hilang tanpa jaring ini berarti satu
 * klien yang sudah membayar tetap terkunci sampai ada yang menelepon.
 *
 * Jawabannya TIDAK bertanda tangan, dan itu tidak apa-apa: yang bertanya kita
 * sendiri, ke alamat Midtrans, memakai server key kita sendiri.
 */
export async function fetchTransactionStatus(
  orderId: string,
): Promise<MidtransNotification | null> {
  if (!midtransConfigured()) return null

  try {
    const res = await fetch(`${apiBase()}/${encodeURIComponent(orderId)}/status`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as MidtransNotification
  } catch {
    // Kegagalan bertanya bukan kegagalan pembayaran. Halaman tetap dirender
    // dengan status yang tersimpan; pemberitahuan resmi masih bisa datang.
    return null
  }
}
