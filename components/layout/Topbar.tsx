import { Icon } from '@/components/ui/icons'
import { BrandMark } from './BrandMark'
import { OutletSwitcher, type OutletOption, type StoreOption } from './OutletSwitcher'
import { SignOutButton } from './SignOutButton'

/**
 * Bar atas area konten. Brand hanya muncul di mobile — di desktop brand sudah
 * berada di puncak kolom gelap.
 *
 * Pemilih outlet ditaruh di sini, bukan di sidebar: ia berlaku untuk seluruh
 * halaman dan harus terlihat sama di desktop maupun ponsel. Sidebar tidak ada
 * di layar sempit.
 */
export function Topbar({
  context,
  initials,
  outlets,
  activeOutletId,
  stores,
  activeStoreId,
  storeName,
}: {
  context: string
  initials: string
  outlets: OutletOption[]
  activeOutletId: string | null
  stores: StoreOption[]
  activeStoreId: string | null
  storeName: string | null
}) {
  // Penanda untuk CSS: di layar sempit, brand + pemilih outlet + tiga tombol
  // tidak muat bersamaan. Toko satu outlet (mayoritas warung) tidak terpengaruh
  // sama sekali — topbarnya persis seperti sebelum multi-outlet ada.
  const multi = outlets.length > 1 || stores.length > 1

  return (
    <header className={multi ? 'topbar has-outlet-switch' : 'topbar'}>
      <div className="topbar-brand">
        <BrandMark context={context} />
      </div>
      <div className="topbar-right">
        <OutletSwitcher
          outlets={outlets}
          activeId={activeOutletId}
          stores={stores}
          activeStoreId={activeStoreId}
          storeName={storeName}
        />
        <button className="icon-btn" type="button" aria-label="Notifikasi">
          <Icon name="bell" size={16} />
        </button>
        <div className="avatar" title={initials}>
          {initials}
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
