import { getMeta, setMeta } from './db'
import { createClient } from '@/lib/supabase/client'

/**
 * Nomor urut transaksi harian per perangkat.
 *
 * Versi pertama menyimpan penghitung ini HANYA di IndexedDB. Begitu penyimpanan
 * lokal hilang — kasir membersihkan browser, ganti perangkat, mode penyamaran —
 * penghitungnya balik ke 1 dan bentrok dengan nomor yang sudah ada. Server
 * menyelamatkan datanya dengan menambahkan akhiran `-R1`, tapi itu justru
 * merusak jaminan yang paling penting: nomor di struk yang sudah dicetak harus
 * sama selamanya dengan nomor di pembukuan.
 *
 * Sekarang penghitung disemai dari server saat hari berganti atau saat cache
 * kosong. Kalau perangkat sedang offline dan tidak punya penghitung sama
 * sekali, nomor diambil dari detik-sejak-tengah-malam: nilainya selalu naik,
 * selalu jauh di atas jumlah transaksi harian yang masuk akal, jadi tidak
 * mungkin menabrak nomor yang sudah terpakai.
 */

const TZ = 'Asia/Makassar'

export function storeToday(at: Date = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: TZ })
}

function secondsSinceMidnight(at: Date = new Date()): number {
  const [h, m, s] = at
    .toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false })
    .split(':')
    .map(Number)
  return h * 3600 + m * 60 + s
}

/** Ambil nomor tertinggi yang sudah dipakai perangkat ini hari ini. */
async function seedFromServer(deviceId: string, today: string): Promise<number | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('transactions')
      .select('code')
      .eq('device_id', deviceId)
      .gte('client_created_at', `${today}T00:00:00+08:00`)
      .lte('client_created_at', `${today}T23:59:59+08:00`)
      .limit(500)

    if (error || !data) return null

    // Ambil segmen angka terakhir, abaikan akhiran -R<n> hasil penyelesaian
    // bentrok agar tidak dihitung sebagai nomor urut.
    const numbers = data
      .map((r) => /-(\d+)(?:-R\d+)?$/.exec(r.code)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number)

    return numbers.length ? Math.max(...numbers) : 0
  } catch {
    return null
  }
}

export async function nextSequence(deviceId: string): Promise<number> {
  const today = storeToday()
  const stored = await getMeta<{ date: string; seq: number }>('trx_counter')

  let seq: number
  if (stored?.date === today) {
    seq = stored.seq + 1
  } else {
    const seed = await seedFromServer(deviceId, today)
    seq =
      seed === null
        ? // Offline tanpa riwayat lokal — pakai jam sebagai nomor.
          secondsSinceMidnight()
        : seed + 1
  }

  await setMeta('trx_counter', { date: today, seq })
  return seq
}
