import { Icon } from '@/components/ui/icons'

/**
 * Nomor admin TokoKu.
 *
 * Ditulis dalam format internasional TANPA tanda plus — itu yang diminta
 * `wa.me`. `081237597759` yang dipakai sehari-hari akan gagal dibuka: wa.me
 * membacanya sebagai nomor Amerika Serikat berawalan 0 dan berujung di halaman
 * "nomor tidak valid".
 */
const ADMIN_WA = '6281237597759'
/** Yang dilihat pemilik toko — nomor lokal, bukan bentuk internasionalnya. */
const ADMIN_WA_TAMPIL = '0812-3759-7759'

/**
 * Tombol hubungi admin lewat WhatsApp.
 *
 * Pesannya sudah terisi nama toko, paket, dan statusnya. Pemilik warung yang
 * mengetik sendiri hampir selalu mengirim "halo" saja, lalu admin harus balik
 * bertanya toko mana — dua putaran percakapan sebelum ada yang bisa dikerjakan.
 */
export function WhatsAppButton({
  storeName,
  planName,
  status,
}: {
  storeName: string
  planName: string | null
  status: string
}) {
  const pesan = [
    'Halo admin TokoKu, saya mau tanya soal langganan.',
    '',
    `Toko: ${storeName}`,
    `Paket: ${planName ?? 'belum berpaket'}`,
    `Status: ${status}`,
  ].join('\n')

  const href = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(pesan)}`

  return (
    <div style={{ marginTop: 16 }}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-dark"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <Icon name="whatsapp" size={16} />
        Hubungi Admin TokoKu
      </a>
      <div className="field-hint" style={{ marginTop: 8 }}>
        WhatsApp {ADMIN_WA_TAMPIL}. Terbuka di aplikasi WhatsApp Anda sendiri.
      </div>
    </div>
  )
}
