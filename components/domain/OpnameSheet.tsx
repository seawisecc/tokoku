'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkOpname } from '@/app/(toko)/produk/actions'
import { Icon } from '@/components/ui/icons'

export type OpnameRow = {
  id: string
  name: string
  sku: string
  unit: string
  stock: number
}

/**
 * Lembar opname: hitung fisik banyak produk sekaligus.
 *
 * Bentuknya sengaja daftar panjang berisi kotak isian, bukan drawer satu per
 * satu. Opname dikerjakan sambil berdiri di depan rak dengan HP di tangan:
 * orangnya berjalan menyusuri rak dan mengetik angka, dan tiap langkah yang
 * memaksa membuka-tutup panel membuatnya kehilangan tempat terakhir.
 */
export function OpnameSheet({ rows, outletName }: { rows: OpnameRow[]; outletName: string }) {
  const [hitung, setHitung] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState('')
  const [cari, setCari] = useState('')
  const [hanyaSelisih, setHanyaSelisih] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sukses, setSukses] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  /** Baris yang benar-benar diisi DAN berbeda dari stok tercatat. */
  const perubahan = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, isi: hitung[r.id] }))
        .filter(({ isi }) => isi !== undefined && isi.trim() !== '')
        .map(({ row, isi }) => ({ row, qty: Number(isi) }))
        .filter(({ row, qty }) => Number.isInteger(qty) && qty >= 0 && qty !== row.stock),
    [rows, hitung],
  )

  const terisi = useMemo(
    () => rows.filter((r) => (hitung[r.id] ?? '').trim() !== '').length,
    [rows, hitung],
  )

  const selisihTotal = perubahan.reduce((n, p) => n + (p.qty - p.row.stock), 0)

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.sku.toLowerCase().includes(q)) return false
      if (hanyaSelisih) {
        const isi = (hitung[r.id] ?? '').trim()
        if (isi === '' || Number(isi) === r.stock) return false
      }
      return true
    })
  }, [rows, cari, hanyaSelisih, hitung])

  function simpan() {
    setError(null)
    setSukses(null)
    startTransition(async () => {
      const res = await bulkOpname(
        perubahan.map((p) => ({ productId: p.row.id, qty: p.qty })),
        catatan,
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSukses(`${perubahan.length} produk disesuaikan.`)
      setHitung({})
      setCatatan('')
      router.refresh()
    })
  }

  if (rows.length === 0) {
    return (
      <div className="table-card">
        <div className="placeholder-card" style={{ border: 'none' }}>
          Belum ada produk yang mencatat stok. Tambahkan produknya dulu di halaman Produk.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card form-narrow" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="opnameNote">Catatan sesi opname</label>
          <input
            id="opnameNote"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={`Mis. Opname bulanan ${outletName}`}
            maxLength={140}
          />
          <div className="field-hint">
            Ikut tercatat di kartu stok tiap produk, jadi enam bulan lagi masih bisa dilacak
            angkanya berubah karena apa.
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="tf-input" style={{ flex: '1 1 200px' }}>
            <Icon name="search" size={15} />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau SKU…"
              aria-label="Cari produk"
            />
          </div>
          <button
            type="button"
            className={`btn btn-sm ${hanyaSelisih ? 'btn-dark' : 'btn-ghost'}`}
            onClick={() => setHanyaSelisih((v) => !v)}
          >
            Hanya yang selisih
          </button>
        </div>

        <div className="table-scroll">
          <table className="opname-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th style={{ textAlign: 'right' }}>Stok tercatat</th>
                <th style={{ textAlign: 'right' }}>Hasil hitung</th>
                <th style={{ textAlign: 'right' }}>Selisih</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r) => {
                const isi = (hitung[r.id] ?? '').trim()
                const qty = Number(isi)
                const sah = isi !== '' && Number.isInteger(qty) && qty >= 0
                const selisih = sah ? qty - r.stock : null
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-name">{r.name}</div>
                      <div className="cell-sub mono">{r.sku}</div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">
                      {r.stock} {r.unit}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="opname-input"
                        value={hitung[r.id] ?? ''}
                        onChange={(e) =>
                          setHitung((h) => ({ ...h, [r.id]: e.target.value.replace(/[^\d]/g, '') }))
                        }
                        inputMode="numeric"
                        placeholder="-"
                        aria-label={`Hasil hitung ${r.name}`}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {selisih === null ? (
                        <span className="cell-sub">belum dihitung</span>
                      ) : selisih === 0 ? (
                        /* Cocok tidak diberi warna. Kalau keadaan normal ikut
                           berwarna, mata berhenti membedakan mana yang perlu
                           ditindaklanjuti — aturan yang sama dengan selisih kas
                           di Laporan Shift. */
                        <span className="cell-sub">cocok</span>
                      ) : (
                        <span className={`badge ${selisih > 0 ? 'badge-ok' : 'badge-low'}`}>
                          {selisih > 0 ? '+' : ''}
                          {selisih}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {tampil.length === 0 && (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Tidak ada produk yang cocok.
          </div>
        )}
      </div>

      {/* Bar simpan menempel di bawah layar. Daftarnya panjang, dan tombol
          simpan yang cuma ada di ujung bawah memaksa orang menggulir melewati
          seluruh rak yang sudah dihitung setiap kali mau menyimpan. */}
      <div className="opname-bar">
        <div className="opname-bar-info">
          <strong>{terisi}</strong> dari {rows.length} dihitung
          {perubahan.length > 0 && (
            <>
              {' · '}
              <strong>{perubahan.length}</strong> selisih
              {' · '}
              <span className={selisihTotal < 0 ? 'opname-minus' : undefined}>
                total {selisihTotal > 0 ? '+' : ''}
                {selisihTotal}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || perubahan.length === 0}
          onClick={simpan}
        >
          {pending ? 'Menyimpan…' : `Simpan Opname${perubahan.length ? ` (${perubahan.length})` : ''}`}
        </button>
      </div>

      {error && (
        <div className="empty-note" style={{ marginTop: 12 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}
      {sukses && (
        <div className="empty-note" style={{ marginTop: 12 }} role="status">
          <Icon name="check" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{sukses}</div>
        </div>
      )}
    </>
  )
}
