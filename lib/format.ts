/** Format uang rupiah. Nilai di DB selalu bigint rupiah bulat. */
export function rupiah(n: number | null | undefined): string {
  return 'Rp ' + Number(n ?? 0).toLocaleString('id-ID')
}

/** Rupiah ringkas untuk kartu statistik: Rp 3,2 jt */
export function rupiahShort(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (v >= 1_000) return `Rp ${(v / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return rupiah(v)
}

const TZ = 'Asia/Makassar'

export function jam(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export function tanggal(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
}

/** Gabungkan className, buang yang falsy. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
