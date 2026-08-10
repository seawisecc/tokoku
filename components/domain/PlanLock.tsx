import { Icon } from '@/components/ui/icons'

/**
 * Penanda bagian yang dikunci paket.
 *
 * Sengaja MENGGANTIKAN isinya, bukan menghilangkannya. Bagian yang lenyap tanpa
 * jejak membuat aplikasinya terbaca belum jadi — pemilik toko tidak tahu ada
 * sesuatu di sana, jadi tidak pernah terpikir untuk naik paket, dan kalau pernah
 * melihatnya di demo ia justru mengira fiturnya rusak.
 *
 * Tidak mengulang judul: pemakainya selalu berada tepat di bawah `.section-title`
 * yang sudah menyebut nama bagiannya. Diulang, layarnya berisi dua baris kembar
 * dan yang terbaca justru judulnya, bukan keterangannya.
 *
 * Nadanya menyebut apa yang akan didapat, bukan apa yang tidak boleh — ini
 * dibaca pemilik warung, bukan penagih.
 */
export function PlanLock({ plan = 'Growth', children }: { plan?: string; children: React.ReactNode }) {
  return (
    <div className="plan-lock">
      <Icon name="chart" size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <span className="badge badge-trial">{plan}</span>
    </div>
  )
}
