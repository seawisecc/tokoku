/**
 * Blok brand di topbar.
 *
 * Slot `context` adalah baris kecil di bawah nama — di wireframe dipakai untuk
 * konteks toko ("Toko Dewi · Denpasar"). Untuk halaman publik dan auth, slot
 * ini diisi "by Seawise Studio" sehingga branding studio tetap tampil penuh.
 */
export function BrandMark({ context }: { context: string }) {
  return (
    <div className="brand">
      <div className="brand-mark">T</div>
      <div className="brand-name">
        TokoKu
        <small>{context}</small>
      </div>
    </div>
  )
}
