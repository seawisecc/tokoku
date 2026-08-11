'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeStoreLogo, uploadStoreLogo } from '@/app/(toko)/pengaturan/actions'
import { Icon } from '@/components/ui/icons'

const MAX_BYTES = 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Unggah logo toko.
 *
 * Dipisah dari `StoreSettingsForm` dan TIDAK ikut tombol Simpannya: berkas
 * berjalan lewat jalur yang berbeda (storage, bukan kolom biasa), dan
 * menggabungkannya berarti mengganti logo baru berlaku setelah menekan Simpan
 * sementara pratinjaunya sudah berubah duluan. Di sini unggahannya berdiri
 * sendiri dan langsung berlaku — yang terlihat sama dengan yang tersimpan.
 */
export function LogoUploader({ logoUrl, storeName }: { logoUrl: string | null; storeName: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function pilih(file: File | undefined) {
    if (!file) return

    /**
     * Diperiksa di sini JUGA, bukan diserahkan ke server.
     *
     * Berkas 4 MB di jaringan warung butuh belasan detik untuk sampai, lalu
     * ditolak. Memeriksanya di perangkat membuat penolakannya seketika.
     * Gerbang sungguhannya tetap di bucket dan di server action — lihat
     * `uploadStoreLogo`.
     */
    if (!TYPES.includes(file.type)) {
      setNotice({ tone: 'bad', text: 'Logo harus berupa gambar PNG, JPG, atau WebP.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setNotice({
        tone: 'bad',
        text: `Ukuran logo maksimal 1 MB, punya Anda ${(file.size / 1024 / 1024).toFixed(1)} MB. Perkecil dulu.`,
      })
      return
    }

    const fd = new FormData()
    fd.set('logo', file)
    startTransition(async () => {
      const res = await uploadStoreLogo(fd)
      setNotice(
        res.ok
          ? { tone: 'ok', text: res.message ?? 'Logo tersimpan.' }
          : { tone: 'bad', text: res.error },
      )
      if (res.ok) router.refresh()
    })
  }

  function hapus() {
    startTransition(async () => {
      const res = await removeStoreLogo()
      setNotice(
        res.ok
          ? { tone: 'ok', text: res.message ?? 'Logo dihapus.' }
          : { tone: 'bad', text: res.error },
      )
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="card form-narrow" style={{ marginBottom: 16 }}>
      <div className="field">
        <label htmlFor="logo">Logo Toko</label>

        <div className="logo-row">
          <div className="logo-preview" aria-hidden={!logoUrl}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL storage
              // pihak ketiga; next/image butuh konfigurasi domain dan tidak
              // memberi keuntungan apa pun untuk satu gambar 1 MB yang jarang berubah.
              <img src={logoUrl} alt={`Logo ${storeName}`} />
            ) : (
              <span className="logo-empty">
                <Icon name="box" size={18} />
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              ref={inputRef}
              id="logo"
              type="file"
              accept={TYPES.join(',')}
              hidden
              onChange={(e) => {
                pilih(e.target.files?.[0])
                // Dikosongkan supaya memilih BERKAS YANG SAMA lagi tetap memicu
                // onChange — kalau tidak, mencoba ulang setelah gagal terasa mati.
                e.target.value = ''
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-dark"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                {pending ? 'Mengunggah…' : logoUrl ? 'Ganti logo' : 'Pilih logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={pending}
                  onClick={hapus}
                >
                  Hapus
                </button>
              )}
            </div>
            <div className="field-hint">
              PNG, JPG, atau WebP. Maksimal 1 MB. Tampil di kolom navigasi dan tercetak di
              struk. Untuk struk, gambar berlatar putih dengan garis tegas paling terbaca,
              karena printer thermal hanya mengenal hitam dan putih.
            </div>
          </div>
        </div>

        {notice && (
          <div
            className="empty-note"
            style={
              notice.tone === 'ok'
                ? {
                    marginTop: 12,
                    background: 'var(--color-success-soft)',
                    color: 'var(--color-success)',
                  }
                : { marginTop: 12 }
            }
            role="alert"
          >
            <Icon
              name={notice.tone === 'ok' ? 'check' : 'alert'}
              size={16}
              style={{ marginTop: 1 }}
            />
            <div style={{ flex: 1 }}>{notice.text}</div>
          </div>
        )}
      </div>
    </div>
  )
}
