'use client'

import { useState } from 'react'
import { Drawer } from '@/components/overlay/Drawer'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'
import type { JenisLaporan } from '@/lib/report-exports'

export type PilihanLaporan = { jenis: JenisLaporan; label: string }

/**
 * Tombol unduh laporan: ikon di samping judul halaman, panel pilihan di dalam.
 *
 * Bentuknya ikon, bukan tombol berteks, karena ia tindakan ATAS halaman dan
 * bukan salah satu pilihan di dalamnya — tombol berteks sebesar tombol periode
 * membuat keduanya terbaca setara, padahal yang satu mengubah isi layar dan
 * yang satu mengeluarkan berkas. Keterangannya muncul saat kursor menyentuhnya
 * lewat `title`, dan pembaca layar membacanya lewat `aria-label` yang sama.
 *
 * Tanggalnya bisa diubah, tapi TERISI dulu dengan periode yang sedang dilihat.
 * Itu yang membuat kasus paling umum (unduh apa yang barusan saya lihat) selesai
 * dalam dua ketukan, sementara "1 sampai 15 Agustus" tetap mungkin tanpa
 * memaksa orang mengarang tanggal dari nol.
 */
export function ExportReportButton({
  pilihan,
  dari: dariAwal,
  sampai: sampaiAwal,
  outlet,
  judul = 'Unduh Laporan',
}: {
  /** Satu jenis, atau beberapa kalau halamannya memang punya lebih dari satu. */
  pilihan: PilihanLaporan[]
  dari: string
  sampai: string
  /** id outlet, 'semua', atau kosong untuk mengikuti outlet aktif. */
  outlet?: string
  judul?: string
}) {
  const [buka, setBuka] = useState(false)
  const [jenis, setJenis] = useState<JenisLaporan>(pilihan[0].jenis)
  const [dari, setDari] = useState(dariAwal)
  const [sampai, setSampai] = useState(sampaiAwal)
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')

  const salah = !dari || !sampai || dari > sampai

  const params = `jenis=${jenis}&dari=${dari}&sampai=${sampai}${outlet ? `&outlet=${outlet}` : ''}`
  const href = format === 'csv' ? `/laporan/ekspor?${params}` : `/laporan/cetak?${params}`
  const keterangan =
    pilihan.length === 1
      ? `Unduh ${pilihan[0].label.toLowerCase()} sebagai CSV atau PDF`
      : 'Unduh laporan sebagai CSV atau PDF'

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        title={keterangan}
        aria-label={keterangan}
        onClick={() => setBuka(true)}
      >
        <Icon name="download" size={16} />
      </button>

      {buka && (
        <Drawer
          open
          title={judul}
          onClose={() => setBuka(false)}
          footer={
            <>
              <button className="btn btn-ghost" type="button" onClick={() => setBuka(false)}>
                Batal
              </button>
              {/*
                Tautan biasa ber-`download`, bukan tombol ber-JavaScript. Yang
                dikirim server adalah berkas dan browser sudah tahu cara
                menyimpannya; merakitnya jadi blob di klien berarti seluruh isi
                laporan harus muat di memori ponsel dulu.

                Untuk PDF `download` sengaja TIDAK dipasang: yang dibuka adalah
                halaman cetak, dan browser yang diminta mengunduh halaman HTML
                akan menyimpannya sebagai berkas .html alih-alih membuka dialog
                cetaknya.
              */}
              <a
                className={cn('btn btn-primary', salah && 'is-mati')}
                href={salah ? undefined : href}
                {...(format === 'csv' ? { download: true } : { target: '_blank', rel: 'noreferrer' })}
                aria-disabled={salah}
                onClick={() => !salah && setBuka(false)}
                style={{ textDecoration: 'none' }}
              >
                {format === 'csv' ? 'Unduh CSV' : 'Buka & Simpan PDF'}
              </a>
            </>
          }
        >
          {pilihan.length > 1 && (
            <div className="field">
              <label htmlFor="expJenis">Laporan</label>
              <select
                id="expJenis"
                value={jenis}
                onChange={(e) => setJenis(e.target.value as JenisLaporan)}
              >
                {pilihan.map((p) => (
                  <option key={p.jenis} value={p.jenis}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="btn-pair">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="expDari">Dari Tanggal</label>
              <input
                id="expDari"
                type="date"
                value={dari}
                max={sampai || undefined}
                onChange={(e) => setDari(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="expSampai">Sampai Tanggal</label>
              <input
                id="expSampai"
                type="date"
                value={sampai}
                min={dari || undefined}
                onChange={(e) => setSampai(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Format</label>
            <div className="pay-methods">
              <button
                type="button"
                className={cn(format === 'csv' && 'active')}
                onClick={() => setFormat('csv')}
              >
                CSV
              </button>
              <button
                type="button"
                className={cn(format === 'pdf' && 'active')}
                onClick={() => setFormat('pdf')}
              >
                PDF
              </button>
            </div>
            <div className="field-hint">
              {format === 'csv'
                ? 'Berkas untuk dibuka di Excel atau dikirim ke akuntan.'
                : 'Lembar cetak akan terbuka beserta dialog cetak. Pilih "Simpan sebagai PDF" di sana untuk menyimpannya sebagai berkas.'}
            </div>
          </div>

          {salah && (
            <div className="empty-note" role="alert">
              <Icon name="alert" size={16} style={{ marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                Tanggal awalnya harus lebih dulu daripada tanggal akhir.
              </div>
            </div>
          )}
        </Drawer>
      )}
    </>
  )
}
