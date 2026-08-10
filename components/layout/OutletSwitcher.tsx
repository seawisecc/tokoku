'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { switchStore } from '@/app/(toko)/actions'
import { switchOutlet } from '@/app/(toko)/pengaturan/outlet-actions'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type OutletOption = { id: string; name: string; code: string; isPrimary: boolean }
export type StoreOption = { id: string; name: string; city: string | null }

/**
 * Pemilih konteks kerja: toko, lalu outlet.
 *
 * SATU tombol untuk dua tingkat, bukan dua pemilih berdampingan. Topbar di
 * 390px sudah pas-pasan dengan satu pemilih saja — brand, pemilih, lonceng,
 * avatar, keluar. Menambah pemilih kedua mendorong tombol keluar ke luar layar,
 * persis kesalahan yang sudah diperbaiki sekali di sini.
 *
 * Tombolnya menyebut yang paling spesifik: nama outlet kalau tokonya bercabang,
 * nama toko kalau tidak. Yang tidak disebut selalu ada di dalam menunya.
 *
 * Tidak dirender sama sekali kalau user cuma punya satu toko dengan satu outlet
 * — itu mayoritas warung, dan pemilih berisi satu pilihan hanya menambah benda
 * yang harus dipahami.
 */
export function OutletSwitcher({
  outlets,
  activeId,
  stores,
  activeStoreId,
  storeName,
}: {
  outlets: OutletOption[]
  activeId: string | null
  stores: StoreOption[]
  activeStoreId: string | null
  storeName: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const multiStore = stores.length > 1
  const multiOutlet = outlets.length > 1
  if (!multiStore && !multiOutlet) return null

  const activeOutlet = outlets.find((o) => o.id === activeId) ?? outlets[0]
  const label = multiOutlet ? (activeOutlet?.name ?? storeName) : storeName

  function pickOutlet(id: string) {
    if (id === activeId) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      const res = await switchOutlet(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(null)
      setOpen(false)
      router.refresh()
    })
  }

  function pickStore(id: string) {
    if (id === activeStoreId) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      const res = await switchStore(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setError(null)
      setOpen(false)
      // Berpindah toko mengganti SELURUH isi aplikasi — katalog, tim, laporan,
      // bahkan menu yang boleh dilihat. Dimuat ulang penuh, bukan di-refresh
      // sebagian, supaya tidak ada sisa layar toko sebelumnya yang tertinggal.
      router.refresh()
    })
  }

  return (
    <div className="outlet-switch">
      <button
        type="button"
        className="outlet-switch-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
      >
        <Icon name="store" size={14} />
        <span className="outlet-switch-name">{pending ? 'Berpindah…' : label}</span>
        <Icon name="chevronDown" size={13} />
      </button>

      {open && (
        <>
          <div className="outlet-switch-backdrop" onClick={() => setOpen(false)} />
          <div className="outlet-switch-menu" role="menu">
            {multiStore && (
              <>
                <div className="outlet-switch-head">Toko</div>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={s.id === activeStoreId}
                    className={cn('outlet-switch-item', s.id === activeStoreId && 'active')}
                    onClick={() => pickStore(s.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cell-name">{s.name}</div>
                      {s.city && <div className="cell-sub">{s.city}</div>}
                    </div>
                    {s.id === activeStoreId && <Icon name="check" size={14} />}
                  </button>
                ))}
              </>
            )}

            {multiOutlet && (
              <>
                <div className="outlet-switch-head">
                  {multiStore ? `Outlet · ${storeName ?? ''}` : 'Pindah outlet'}
                </div>
                {outlets.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={o.id === activeId}
                    className={cn('outlet-switch-item', o.id === activeId && 'active')}
                    onClick={() => pickOutlet(o.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cell-name">{o.name}</div>
                      <div className="cell-sub">
                        {o.code}
                        {o.isPrimary ? ' · utama' : ''}
                      </div>
                    </div>
                    {o.id === activeId && <Icon name="check" size={14} />}
                  </button>
                ))}
              </>
            )}

            {/* Pintu daftar toko baru ditaruh di sini, bukan di Pengaturan:
                orang yang sadar sedang berpindah-pindah toko adalah orang yang
                sama yang mungkin ingin menambah satu lagi.
                Disembunyikan saat `stores` kosong — itu tandanya Super Admin
                yang sedang memakai "Lihat sebagai Klien", dan ia tidak
                mendaftarkan toko atas nama siapa pun. */}
            {stores.length > 0 && (
            <Link
              href="/daftar-toko"
              className="outlet-switch-item outlet-switch-add"
              onClick={() => setOpen(false)}
            >
              <Icon name="plus" size={14} />
              <span style={{ flex: 1 }}>Daftarkan toko baru</span>
            </Link>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="outlet-switch-menu" role="alert" style={{ padding: '10px 12px' }}>
          {error}
        </div>
      )}
    </div>
  )
}
