/**
 * Blok brand di topbar.
 *
 * Slot `context` adalah baris kecil di bawah nama — di wireframe dipakai untuk
 * konteks toko ("Toko Dewi · Denpasar"). Untuk halaman publik dan auth, slot
 * ini diisi "by Seawise Studio" sehingga branding studio tetap tampil penuh.
 *
 * `logoUrl` opsional dan sengaja begitu: halaman publik, auth, dan area Super
 * Admin tidak punya toko, jadi mereka tetap memakai kotak "T" seperti semula.
 */
export function BrandMark({ context, logoUrl }: { context: string; logoUrl?: string | null }) {
  return (
    <div className="brand">
      <BrandLogo logoUrl={logoUrl} />
      <div className="brand-name">
        TokoKu
        <small>{context}</small>
      </div>
    </div>
  )
}

/**
 * Kotak logo, dipakai bersama oleh topbar dan sidebar supaya keduanya tidak
 * pernah berbeda saat logonya diganti.
 *
 * Nama tokonya tidak dipakai sebagai `alt` melainkan dikosongkan: teks
 * "TokoKu" tepat di sebelahnya sudah menyebut identitasnya, dan pembaca layar
 * yang mengumumkan keduanya justru membacakan nama toko dua kali.
 */
export function BrandLogo({ logoUrl }: { logoUrl?: string | null }) {
  if (!logoUrl) return <div className="brand-mark">T</div>

  return (
    <div className="brand-mark has-logo">
      {/* eslint-disable-next-line @next/next/no-img-element -- berkas storage
          Supabase; next/image butuh konfigurasi domain dan tidak memberi
          keuntungan untuk satu gambar kecil yang jarang berubah. */}
      <img src={logoUrl} alt="" />
    </div>
  )
}
