'use client'

import { useState } from 'react'
import { savePrinter } from '@/app/(toko)/pengaturan/actions'
import { Receipt } from '@/components/pos/Receipt'
import { SettingsForm, ToggleRow } from './SettingsForm'

export type PrinterValues = {
  paper: '58mm' | '80mm'
  header: string
  footer: string
  showLogo: boolean
  autoPrint: boolean
}

export function PrinterSettingsForm({
  outletId,
  storeName,
  logoUrl,
  initial,
}: {
  outletId: string
  storeName: string
  /** Logo toko, supaya pratinjau menunjukkan struk yang sebenarnya akan tercetak. */
  logoUrl: string | null
  initial: PrinterValues
}) {
  const [v, setV] = useState(initial)
  const set = <K extends keyof PrinterValues>(k: K, val: PrinterValues[K]) =>
    setV((s) => ({ ...s, [k]: val }))

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div className="card form-narrow">
        <SettingsForm action={(fd) => savePrinter(outletId, fd)}>
          <div className="field">
            <label htmlFor="paper">Lebar Kertas</label>
            <select
              id="paper"
              name="paper"
              value={v.paper}
              onChange={(e) => set('paper', e.target.value as '58mm' | '80mm')}
            >
              <option value="58mm">58 mm (paling umum)</option>
              <option value="80mm">80 mm</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="header">Baris Atas Struk</label>
            <input
              id="header"
              name="header"
              value={v.header}
              onChange={(e) => set('header', e.target.value)}
              placeholder="Opsional, mis. slogan toko"
            />
          </div>

          <div className="field">
            <label htmlFor="footer">Baris Bawah Struk</label>
            <input
              id="footer"
              name="footer"
              value={v.footer}
              onChange={(e) => set('footer', e.target.value)}
              placeholder="Terima kasih telah berbelanja"
            />
          </div>

          <ToggleRow
            name="showLogo"
            label="Tampilkan logo"
            hint={
              logoUrl
                ? 'Logo toko dicetak di kepala struk, di atas nama toko.'
                : 'Belum ada logo. Unggah dulu di Pengaturan → Toko.'
            }
            defaultChecked={v.showLogo}
            onToggle={(b) => set('showLogo', b)}
          />
          <ToggleRow
            name="autoPrint"
            label="Cetak otomatis setelah bayar"
            hint="Kalau dimatikan, kasir menekan tombol Cetak sendiri."
            defaultChecked={v.autoPrint}
          />
        </SettingsForm>
      </div>

      <div>
        <div className="section-title" style={{ marginTop: 0 }}>Pratinjau</div>
        <div className="receipt-preview" style={{ maxWidth: 260 }}>
          <Receipt
            data={{
              code: 'TRX-20260807-K1-0042',
              storeName,
              logoUrl: v.showLogo ? logoUrl : null,
              storeAddress: null,
              storePhone: null,
              outletName: null,
              cashierName: 'Kasir',
              at: new Date().toISOString(),
              paymentMethod: 'cash',
              items: [
                { name: 'Minyak Goreng Sania 2L', qty: 2, unitPrice: 21000, lineTotal: 42000 },
                { name: 'Teh Pucuk 350ml', qty: 1, unitPrice: 5000, lineTotal: 5000 },
              ],
              subtotal: 47000,
              total: 47000,
              paid: 50000,
              change: 3000,
              footer: v.footer,
            }}
          />
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Pratinjau memakai contoh transaksi. Baris bawah mengikuti isian di samping.
        </p>
      </div>
    </div>
  )
}
