'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Notice } from '@/lib/notifications'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

/**
 * Lonceng notifikasi di topbar.
 *
 * Sebelum ini tombolnya benar-benar mati — tidak ada `onClick`, tidak ada
 * panel. Sekarang isinya datang dari server lewat AppShell, dan sengaja
 * TIDAK dipoll berkala: perhitungannya ikut tiap kali halaman dirender, dan
 * seluruh halaman toko sudah `force-dynamic`. Denyut tambahan cuma akan
 * membebani jaringan warung untuk angka yang berubah beberapa kali sehari.
 *
 * **Tidak ada tanda "sudah dibaca", dan itu disengaja.** Semua yang muncul di
 * sini adalah keadaan yang MASIH berlangsung, bukan peristiwa yang lewat.
 * Stok yang menipis tidak berhenti menipis karena loncengnya dibuka; menandai
 * "sudah dibaca" cuma akan menyembunyikan masalah yang belum selesai. Butirnya
 * hilang sendiri begitu keadaannya benar-benar beres.
 */
export function NotificationBell({ notices }: { notices: Notice[] }) {
  const [buka, setBuka] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Klik di luar dan Escape menutup panelnya. Tanpa keduanya, panel yang
  // terbuka di ponsel menutupi topbar dan tidak ada cara jelas menutupnya.
  useEffect(() => {
    if (!buka) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setBuka(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuka(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [buka])

  const mendesak = notices.some((n) => n.tone === 'danger')
  /**
   * Lencana menghitung yang PERLU DITINDAKLANJUTI saja (`danger` + `warn`).
   *
   * Butir `info` — sisa masa langganan, stok menipis — tetap tampil di dalam
   * panel tapi tidak ikut membuat angka. Kalau ikut, toko yang masih dalam masa
   * coba akan melihat lencana berangka setiap hari selama dua minggu, dan
   * begitu angka itu jadi pemandangan biasa, angka merah yang sungguhan
   * berhenti dibaca. Yang tersisa cuma titik kecil: ada isinya, tapi tidak
   * menuntut apa pun sekarang.
   */
  const perluTindakan = notices.filter((n) => n.tone !== 'info').length

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="icon-btn"
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-label={
          perluTindakan > 0
            ? `Notifikasi, ${perluTindakan} perlu perhatian`
            : notices.length > 0
              ? `Notifikasi, ${notices.length} keterangan`
              : 'Notifikasi, tidak ada'
        }
        title="Notifikasi"
      >
        <Icon name="bell" size={16} />
        {/* Lencana angka, bukan titik polos: "3" memberi tahu seberapa banyak
            yang menunggu sebelum panelnya dibuka. Merah hanya kalau ada yang
            mendesak — kalau semua notifikasi berwarna merah, tidak ada yang
            merah. */}
        {perluTindakan > 0 ? (
          <span className={cn('notif-badge', mendesak && 'is-danger')}>{perluTindakan}</span>
        ) : (
          notices.length > 0 && <span className="notif-badge is-quiet" aria-hidden />
        )}
      </button>

      {buka && (
        <div className="notif-panel" role="dialog" aria-label="Notifikasi">
          <div className="notif-head">
            {perluTindakan > 0 ? 'Perlu perhatian' : 'Kabar toko'}
          </div>

          {notices.length === 0 ? (
            <div className="notif-empty">
              <Icon name="check" size={15} />
              <span>Tidak ada yang perlu ditindaklanjuti.</span>
            </div>
          ) : (
            notices.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className="notif-item"
                onClick={() => setBuka(false)}
              >
                <span className={cn('notif-dot', `is-${n.tone}`)} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                </span>
                <Icon name="chevronRight" size={14} />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
