'use client'

import { useState, useTransition } from 'react'
import { startSubscriptionPayment } from '@/app/(toko)/pengaturan/langganan/actions'
import { Icon } from '@/components/ui/icons'
import { cn, rupiah } from '@/lib/format'

export type CheckoutPlan = {
  id: string
  name: string
  code: string
  priceMonthly: number
}

/**
 * Pilihan lama bayar.
 *
 * Empat, bukan isian bebas. Pemilik warung tidak punya alasan memilih tujuh
 * bulan, dan isian bebas cuma menambah satu kesempatan salah ketik pada layar
 * yang berujung ke pembayaran. Angka-angkanya mengikuti irama yang sudah
 * dikenal: bulanan, kuartal, semester, tahunan.
 */
const PILIHAN_BULAN = [1, 3, 6, 12] as const

type Props = {
  plans: CheckoutPlan[]
  /** Paket yang sedang dipakai toko, untuk ditandai. null kalau belum berpaket. */
  currentPlanId: string | null
  /** false untuk kasir/anggota biasa: ia boleh melihat, tidak boleh membayar. */
  canPay: boolean
  /** Ada tagihan menunggu yang belum kedaluwarsa. Tombolnya diganti "lanjutkan". */
  pendingOrderId: string | null
  /** Kunci Midtrans belum dipasang. Kartunya tidak dirender sama sekali. */
  enabled: boolean
  /** true saat memakai kunci Sandbox: uangnya tidak sungguhan, dan itu harus terbaca. */
  sandbox: boolean
}

export function SubscriptionCheckout({
  plans,
  currentPlanId,
  canPay,
  pendingOrderId,
  enabled,
  sandbox,
}: Props) {
  const [planId, setPlanId] = useState(currentPlanId ?? plans[0]?.id ?? '')
  const [months, setMonths] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!enabled || plans.length === 0) return null

  const plan = plans.find((p) => p.id === planId) ?? plans[0]
  const total = plan ? plan.priceMonthly * months : 0

  function bayar() {
    setError(null)
    start(async () => {
      const fd = new FormData()
      fd.set('planId', planId)
      fd.set('months', String(months))
      const hasil = await startSubscriptionPayment(fd)

      if (!hasil.ok) {
        setError(hasil.error)
        return
      }

      /**
       * Dialihkan, BUKAN dibuka di tab baru.
       *
       * Tab baru sering diblokir peramban ponsel kalau pembukaannya terjadi
       * setelah menunggu jawaban server, bukan langsung pada ketukan jari. Yang
       * muncul kemudian cuma tombol yang terasa mati — cacat yang sudah pernah
       * terjadi di sini dengan gulir halus.
       *
       * `window.location.href`, bukan router Next: alamatnya milik Midtrans,
       * jadi router aplikasi tidak punya urusan dengannya.
       */
      window.location.href = hasil.redirectUrl
    })
  }

  return (
    <>
      <div className="section-title">
        {pendingOrderId ? 'Selesaikan Pembayaran' : 'Berlangganan atau Perpanjang'}
      </div>

      <div className="card form-narrow">
        {sandbox && (
          <div className="empty-note is-warn" style={{ marginBottom: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Mode uji coba. Pembayaran di halaman berikutnya <b>tidak menagih uang sungguhan</b>
              , dan langganan yang aktif dari sini hanya untuk pengujian.
            </div>
          </div>
        )}

        {/* ── Paket ─────────────────────────────────────────────────────── */}
        <div className="field">
          <label htmlFor="pilih-paket">Paket</label>
          <div className="plan-picker" role="radiogroup" aria-label="Pilih paket langganan">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === planId}
                className={cn('plan-opt', p.id === planId && 'is-on')}
                onClick={() => setPlanId(p.id)}
                disabled={pending}
              >
                <span className="plan-opt-name">
                  {p.name}
                  {p.id === currentPlanId && <span className="plan-opt-now">paket sekarang</span>}
                </span>
                <span className="plan-opt-price">{rupiah(p.priceMonthly)} / bulan</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Lama bayar ────────────────────────────────────────────────── */}
        <div className="field">
          <label>Dibayar untuk</label>
          {/* `.month-picker`, bukan `.tabs`: keempat pilihan ini satu
              perbandingan yang harus terlihat sekaligus, sementara `.tabs`
              memang dibuat untuk digeser. Diukur di 390px, `.tabs` memotong
              "12 bulan" sebanyak 20px. */}
          <div className="month-picker" role="radiogroup" aria-label="Lama berlangganan">
            {PILIHAN_BULAN.map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={b === months}
                className={cn('tab', b === months && 'active')}
                onClick={() => setMonths(b)}
                disabled={pending}
              >
                {b} bulan
              </button>
            ))}
          </div>
          <div className="field-hint">
            Membayar beberapa bulan sekaligus tidak mengubah harga per bulannya. Yang berubah
            cuma seberapa sering Anda perlu kembali ke halaman ini.
          </div>
        </div>

        {/* ── Ringkasan ─────────────────────────────────────────────────── */}
        <div className="checkout-sum">
          <div className="checkout-row">
            <span>
              {plan?.name} · {rupiah(plan?.priceMonthly ?? 0)} × {months} bulan
            </span>
            <span>{rupiah(total)}</span>
          </div>
          <div className="checkout-row is-total">
            <span>Total tagihan</span>
            <span>{rupiah(total)}</span>
          </div>
        </div>

        {error && (
          <div className="empty-note" style={{ marginTop: 14 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {canPay ? (
          <button
            type="button"
            className="btn btn-dark btn-block"
            style={{ marginTop: 16 }}
            onClick={bayar}
            disabled={pending || !plan}
          >
            {pending ? 'Menyiapkan pembayaran…' : pendingOrderId ? 'Lanjutkan Pembayaran' : 'Bayar Sekarang'}
          </button>
        ) : (
          /* Tombolnya tidak dirender sama sekali, bukan dirender lalu ditolak.
             Penolakan yang baru muncul setelah ditekan terbaca seperti tombol
             rusak — alasan yang sama dengan tombol hapus perangkat. */
          <div className="empty-note" style={{ marginTop: 16 }}>
            <Icon name="alert" size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              Hanya pemilik atau admin toko yang bisa membayar langganan. Mintakan ke pemilik
              toko ini.
            </div>
          </div>
        )}

        <div className="field-hint" style={{ marginTop: 12 }}>
          Pembayaran diproses di halaman Midtrans. TokoKu tidak pernah menerima atau menyimpan
          nomor kartu maupun PIN Anda. Masa langganan yang masih tersisa tidak hangus: bulan
          yang Anda bayar ditambahkan di atasnya.
        </div>
      </div>
    </>
  )
}
