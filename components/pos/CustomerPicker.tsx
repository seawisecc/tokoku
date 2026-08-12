'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { createClient } from '@/lib/supabase/client'
import { hpLokal, normalkanHp } from '@/lib/phone'

export type PickedCustomer = { id: string; name: string; phone: string | null }

/**
 * Pilih pelanggan saat membayar.
 *
 * Tanpa ini seluruh CRM tidak pernah berjalan: `transactions.customer_id` ada
 * sejak awal dan poin dihitung di database, tapi kalau kasir tidak punya cara
 * menempelkan pelanggan ke penjualan, kolom itu selamanya null dan tidak ada
 * satu poin pun yang pernah lahir.
 *
 * **Butuh internet.** Daftar pelanggan tidak ikut di-cache seperti katalog
 * produk, jadi saat offline pencariannya tidak bisa jalan. Penjualannya sendiri
 * TIDAK diblokir — pelanggan cuma tidak tercatat, dan itu jauh lebih baik
 * daripada kasir tidak bisa menerima uang karena sinyal hilang.
 */
export function CustomerPicker({
  organizationId,
  online,
  value,
  onChange,
}: {
  organizationId: string
  online: boolean
  value: PickedCustomer | null
  onChange: (c: PickedCustomer | null) => void
}) {
  const [buka, setBuka] = useState(false)
  const [query, setQuery] = useState('')
  const [hasil, setHasil] = useState<PickedCustomer[]>([])
  const [cari, setCari] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buatBaru, setBuatBaru] = useState(false)
  const [namaBaru, setNamaBaru] = useState('')
  const [hpBaru, setHpBaru] = useState('')
  const [simpan, setSimpan] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (buka) inputRef.current?.focus()
  }, [buka])

  /**
   * Pencarian ditunda 300ms.
   *
   * Kasir mengetik nama sambil melayani; menembak server tiap huruf membuat
   * belasan permintaan untuk satu nama, dan di jaringan warung yang lambat
   * jawaban lama bisa datang setelah jawaban baru lalu menimpanya.
   */
  useEffect(() => {
    if (!buka || !online) return
    const q = query.trim()
    if (q.length < 2) {
      setHasil([])
      return
    }
    let batal = false
    const t = setTimeout(async () => {
      setCari(true)
      setError(null)
      try {
        const supabase = createClient()
        const hp = normalkanHp(q)
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .or(`name.ilike.%${q}%${hp ? `,phone.ilike.%${hp}%` : ''}`)
          .order('last_visit_at', { ascending: false, nullsFirst: false })
          .limit(8)
        if (batal) return
        if (error) setError('Pencarian gagal. Coba lagi.')
        else setHasil(data ?? [])
      } finally {
        if (!batal) setCari(false)
      }
    }, 300)
    return () => {
      batal = true
      clearTimeout(t)
    }
  }, [query, buka, online, organizationId])

  async function simpanBaru() {
    const nama = namaBaru.trim()
    if (nama.length < 2) {
      setError('Nama pelanggan minimal 2 huruf.')
      return
    }
    const hp = hpBaru.trim() ? normalkanHp(hpBaru) : null
    if (hpBaru.trim() && !hp) {
      setError('Nomor itu belum lengkap. Tulis lengkap dengan kode awalnya, misalnya 0812 3456 7890.')
      return
    }
    setSimpan(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customers')
        .insert({ organization_id: organizationId, name: nama, phone: hp })
        .select('id, name, phone')
        .single()
      if (error) {
        setError(
          error.message.includes('customers_phone_idx')
            ? 'Nomor HP ini sudah dipakai pelanggan lain. Cari namanya di atas.'
            : 'Pelanggan gagal disimpan.',
        )
        return
      }
      pilih(data)
    } finally {
      setSimpan(false)
    }
  }

  function pilih(c: PickedCustomer) {
    onChange(c)
    setBuka(false)
    setBuatBaru(false)
    setQuery('')
    setNamaBaru('')
    setHpBaru('')
    setHasil([])
    setError(null)
  }

  if (value) {
    return (
      <div className="cust-picked">
        <Icon name="user" size={15} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cust-nama">{value.name}</div>
          {value.phone && <div className="cust-hp mono">{hpLokal(value.phone)}</div>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
          Lepas
        </button>
      </div>
    )
  }

  if (!buka) {
    return (
      <button
        type="button"
        className="btn btn-ghost cust-add"
        onClick={() => setBuka(true)}
        disabled={!online}
        title={online ? undefined : 'Perlu internet untuk mencari pelanggan'}
      >
        <Icon name="user" size={15} />
        {online ? 'Pelanggan (opsional)' : 'Pelanggan tidak bisa dipilih saat offline'}
      </button>
    )
  }

  return (
    <div className="cust-panel">
      {!buatBaru ? (
        <>
          <div className="tf-input">
            <Icon name="search" size={15} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor HP…"
              aria-label="Cari pelanggan"
            />
          </div>

          {cari && <div className="cust-info">Mencari…</div>}

          {!cari && query.trim().length >= 2 && hasil.length === 0 && (
            <div className="cust-info">Tidak ada yang cocok.</div>
          )}

          {hasil.map((c) => (
            <button key={c.id} type="button" className="cust-row" onClick={() => pilih(c)}>
              <span className="cust-nama">{c.name}</span>
              {c.phone && <span className="cust-hp mono">{hpLokal(c.phone)}</span>}
            </button>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
              onClick={() => setBuka(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                // Apa yang sudah diketik dibawa ke form: kasir mengetik nama,
                // tidak ketemu, lalu harus mengetik nama yang sama lagi.
                setNamaBaru(/^\d/.test(query.trim()) ? '' : query.trim())
                setHpBaru(/^\d/.test(query.trim()) ? query.trim() : '')
                setBuatBaru(true)
                setError(null)
              }}
            >
              Pelanggan baru
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="custNama">Nama</label>
            <input
              id="custNama"
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              placeholder="Mis. Bu Sri"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="custHp">Nomor HP</label>
            <input
              id="custHp"
              value={hpBaru}
              onChange={(e) => setHpBaru(e.target.value)}
              placeholder="Ketik nomornya di sini"
              inputMode="tel"
            />
            <div className="field-hint">Opsional, tapi ini yang dipakai mengirim nota.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
              onClick={() => setBuatBaru(false)}
            >
              Kembali
            </button>
            <button
              type="button"
              className="btn btn-dark btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={simpan}
              onClick={simpanBaru}
            >
              {simpan ? 'Menyimpan…' : 'Simpan & pilih'}
            </button>
          </div>
        </>
      )}

      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
