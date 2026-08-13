import { v7 as uuidv7 } from 'uuid'
import type { OutboxItem, OutboxTransaction } from './db'

/**
 * UUID v7, bukan v4: nilainya berurutan menurut waktu, sehingga primary key
 * transaksi tidak memfragmentasi index B-tree di Postgres saat data menumpuk.
 * Dibuat di perangkat — inilah yang membuat sync idempoten (kiriman ulang
 * bentrok primary key, bukan menggandakan data).
 */
export function newTransactionId(): string {
  return uuidv7()
}

/**
 * Nomor transaksi: TRX-20260807-K1-0042
 *
 * Segmen tengah adalah kode perangkat. Dengan itu setiap mesin kasir bisa
 * menomori sendiri tanpa bertanya ke server — syarat mutlak agar bisa
 * mencetak struk saat offline — dan nomornya tetap unik satu toko.
 */
export function buildTransactionCode(deviceCode: string, seq: number, at: Date): string {
  const ymd = at
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' })
    .replaceAll('-', '')
  return `TRX-${ymd}-${deviceCode}-${String(seq).padStart(4, '0')}`
}

export function cartTotal(items: OutboxItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount, 0)
}

/** Bentuk payload yang dikirim ke RPC sync_transactions. */
export function toSyncPayload(trx: OutboxTransaction) {
  return {
    id: trx.id,
    code: trx.code,
    outlet_id: trx.outlet_id,
    device_id: trx.device_id,
    shift_id: trx.shift_id,
    customer_id: trx.customer_id,
    client_created_at: trx.client_created_at,
    payment_method: trx.payment_method,
    paid_amount: trx.paid_amount,
    // Potongan poin. Server tidak menerima `discount_total` dari perangkat
    // sama sekali — ia menghitung sendiri dari jumlah poinnya. Lihat 0039.
    points_redeemed: trx.points_redeemed ?? 0,
    points_value: trx.points_value ?? 0,
    origin: trx.origin,
    items: trx.items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
    })),
  }
}
