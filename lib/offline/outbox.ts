import { db, getMeta, setMeta, stockKey, type OutboxTransaction } from './db'
import { toSyncPayload } from './trx'
import { createClient } from '@/lib/supabase/client'

const BATCH_SIZE = 50
const MAX_ATTEMPTS = 20

export type FlushResult = {
  attempted: number
  accepted: number
  duplicate: number
  rejected: number
  error?: string
}

/**
 * Simpan transaksi ke antrean dan kurangi stok cache lokal.
 *
 * Ditulis dalam satu transaksi Dexie: kalau penulisan outbox gagal, stok lokal
 * juga tidak jadi berkurang — supaya tidak pernah ada keadaan "stok sudah
 * dipotong tapi penjualannya hilang".
 */
export async function enqueue(trx: OutboxTransaction): Promise<void> {
  const d = db()
  await d.transaction('rw', d.outbox, d.stocks, async () => {
    await d.outbox.add(trx)
    for (const item of trx.items) {
      const key = stockKey(item.product_id, trx.outlet_id)
      const row = await d.stocks.get(key)
      if (row) await d.stocks.update(key, { quantity: row.quantity - item.quantity })
    }
  })
}

/**
 * Antrean milik satu toko.
 *
 * `organizationId` opsional demi pemanggil lama, tapi layar POS SELALU
 * mengisinya: satu browser bisa memegang antrean dari dua toko sekaligus
 * (mis. bekas "Lihat sebagai Klien"), dan menghitung semuanya membuat lencana
 * "3 belum tersinkron" menunjuk transaksi toko lain.
 */
export async function pendingCount(organizationId?: string): Promise<number> {
  const rows = await db().outbox.where('status').anyOf('pending', 'sending').toArray()
  return organizationId
    ? rows.filter((t) => t.organization_id === organizationId).length
    : rows.length
}

export async function pendingTransactions(
  organizationId?: string,
): Promise<OutboxTransaction[]> {
  const rows = await db()
    .outbox.where('status')
    .anyOf('pending', 'sending')
    .reverse()
    .sortBy('client_created_at')
  return organizationId ? rows.filter((t) => t.organization_id === organizationId) : rows
}

/**
 * Kirim antrean ke server.
 *
 * Aman dipanggil berulang dan bersamaan: baris ditandai 'sending' lebih dulu,
 * dan server mengenali kiriman ganda lewat primary key (balasannya 'duplicate',
 * bukan error).
 */
export async function flush(organizationId: string, deviceId: string): Promise<FlushResult> {
  const d = db()

  // Baris yang tersangkut di 'sending' (mis. tab ditutup saat mengirim)
  // dikembalikan ke 'pending' agar tidak mandek selamanya.
  const stale = await d.outbox.where('status').equals('sending').toArray()
  const staleCutoff = Date.now() - 60_000
  for (const row of stale) {
    if (new Date(row.client_created_at).getTime() < staleCutoff) {
      await d.outbox.update(row.id, { status: 'pending' })
    }
  }

  // WAJIB disaring per toko. `organizationId` dikirim apa adanya sebagai
  // `p_org` ke server, jadi tanpa saringan ini antrean toko A ikut terkirim
  // atas nama toko B — ditolak server, ditandai 'rejected' di perangkat, dan
  // penjualan yang nyata hilang begitu saja.
  const pending = await d.outbox.where('status').equals('pending').toArray()
  const batch = pending
    .filter((t) => t.organization_id === organizationId)
    .slice(0, BATCH_SIZE)

  if (batch.length === 0) return { attempted: 0, accepted: 0, duplicate: 0, rejected: 0 }

  await Promise.all(batch.map((t) => d.outbox.update(t.id, { status: 'sending' })))

  const supabase = createClient()
  const { data, error } = await supabase.rpc('sync_transactions', {
    p_org: organizationId,
    p_device: deviceId,
    p_batch: batch.map(toSyncPayload),
    p_app_ver: 'web-0.1.0',
  })

  if (error) {
    // Gagal jaringan atau server. Kembalikan ke antrean — JANGAN dibuang.
    for (const t of batch) {
      const attempts = t.attempts + 1
      await d.outbox.update(t.id, {
        status: attempts >= MAX_ATTEMPTS ? 'rejected' : 'pending',
        attempts,
        last_error: error.message,
      })
    }
    return {
      attempted: batch.length,
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      error: error.message,
    }
  }

  const result = data as {
    accepted: number
    duplicate: number
    rejected: number
    results: { status: string; id: string; reason?: string; code?: string }[]
  }

  const byId = new Map(result.results.map((r) => [r.id, r]))
  for (const t of batch) {
    const r = byId.get(t.id)
    if (!r || r.status === 'rejected') {
      await d.outbox.update(t.id, {
        status: 'rejected',
        attempts: t.attempts + 1,
        last_error: r?.reason ?? 'Ditolak server',
      })
    } else {
      // 'duplicate' juga sukses: artinya sudah tercatat di server.
      await d.outbox.update(t.id, {
        status: 'synced',
        synced_at: new Date().toISOString(),
        code: r.code ?? t.code,
        last_error: null,
      })
    }
  }

  await setMeta('last_sync_at', new Date().toISOString())

  return {
    attempted: batch.length,
    accepted: result.accepted,
    duplicate: result.duplicate,
    rejected: result.rejected,
  }
}

/** Buang riwayat lokal yang sudah tersinkron lebih dari 30 hari. */
export async function pruneSynced(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString()
  await db()
    .outbox.where('status')
    .equals('synced')
    .and((t) => t.client_created_at < cutoff)
    .delete()
}

export async function lastSyncAt(): Promise<string | undefined> {
  return getMeta<string>('last_sync_at')
}
