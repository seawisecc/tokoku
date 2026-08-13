'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureShift } from '@/app/(toko)/kasir/actions'
import { Icon } from '@/components/ui/icons'
import {
  localCatalog,
  localCategories,
  pullCatalog,
  seedCatalog,
  type CatalogEntry,
} from '@/lib/offline/catalog'
import { nextSequence } from '@/lib/offline/sequence'
import { getOrRegisterDevice } from '@/lib/offline/device'
import {
  ensureTenant,
  getMeta,
  type LocalCategory,
  type LocalProduct,
  type OutboxTransaction,
} from '@/lib/offline/db'
import { pingServer } from '@/lib/offline/connection'
import { enqueue, flush, pendingCount, pruneSynced } from '@/lib/offline/outbox'
import { buildTransactionCode, newTransactionId } from '@/lib/offline/trx'
import { cn } from '@/lib/format'
import { useCart } from '@/lib/stores/cart'
import { CartBar } from './CartBar'
import { CartPanel } from './CartPanel'
import { CategoryPills } from './CategoryPills'
import { PaymentModal } from './PaymentModal'
import { ProductGrid } from './ProductGrid'
import { SuccessModal, type StoreInfo } from './SuccessModal'
import { CustomerPicker, type PickedCustomer } from './CustomerPicker'
import { PointRedeem } from './PointRedeem'
import { SyncStatusChip } from './SyncStatusChip'
import { BarcodeScanner } from './BarcodeScanner'

export type PosClientProps = {
  /** true kalau langganan toko sedang tertutup — transaksi baru akan ditolak server. */
  subscriptionLapsed: boolean
  organizationId: string
  outletId: string
  cashierName: string
  supabaseUrl: string
  allowNegativeStock: boolean
  /**
   * Aturan poin toko ini. `enabled` sudah menggabungkan sakelar toko DAN
   * gerbang paket — layar kasir tidak perlu tahu mana yang mematikannya, dan
   * menggabungkannya di server berarti kasir tidak pernah melihat tombol tukar
   * poin yang lalu ditolak diam-diam.
   */
  loyalty: { enabled: boolean; pointValue: number }
  store: StoreInfo
  initialProducts: (Omit<LocalProduct, 'organization_id'> & { stock: number })[]
  initialCategories: Omit<LocalCategory, 'organization_id'>[]
}

export function PosClient(props: PosClientProps) {
  const [products, setProducts] = useState<CatalogEntry[]>([])
  // Isi awal dari server belum berstempel tenant; setelah seedCatalog jalan,
  // daftar ini diganti hasil bacaan lokal yang sudah tersaring per toko.
  const [categories, setCategories] = useState<Omit<LocalCategory, 'organization_id'>[]>(
    props.initialCategories,
  )
  const [category, setCategory] = useState('Semua')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [redeem, setRedeem] = useState(0)
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [device, setDevice] = useState<{ id: string; code: string } | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [modal, setModal] = useState<'pay' | 'success' | null>(null)
  const [lastReceipt, setLastReceipt] = useState<OutboxTransaction | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Dibedakan dari `notice` biasa: kalau perangkat gagal terdaftar, tombol
  // bayar tidak akan pernah hidup — labelnya harus mengatakan itu, bukan
  // "Menyiapkan…" yang terbaca seperti sedang berjalan.
  const [deviceFailed, setDeviceFailed] = useState(false)

  // Dikunci di sini, bukan dibiarkan gagal saat menekan Bayar. Server memang
  // akan menolaknya, tapi kasir sudah terlanjur memindai belasan barang dan
  // pembeli sudah menunggu — penolakan harus terlihat SEBELUM keranjang disusun.
  const blocked = props.subscriptionLapsed

  const cart = useCart()

  // Keranjang sengaja baru dipulihkan dari localStorage setelah render pertama,
  // supaya render itu masih sama persis dengan HTML dari server. Lihat alasan
  // lengkapnya di `skipHydration` pada lib/stores/cart.ts.
  useEffect(() => {
    void (async () => {
      await useCart.persist.rehydrate()
      // HARUS setelah rehydrate: sebelum itu store masih kosong, jadi
      // pemeriksaannya akan selalu lolos dan keranjang toko lain tetap terbawa.
      useCart.getState().bindOrg(props.organizationId, props.outletId)
    })()
  }, [props.organizationId, props.outletId])

  const refreshLocal = useCallback(async () => {
    setProducts(await localCatalog(props.organizationId, props.outletId))
    setCategories(await localCategories(props.organizationId))
    setPending(await pendingCount(props.organizationId))
    setLastSync((await getMeta<string>('last_sync_at')) ?? null)
  }, [props.outletId, props.organizationId])

  // ---------- inisialisasi: cache katalog + daftarkan perangkat ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // HARUS sebelum seedCatalog: kalau cache toko lain masih ada, katalognya
      // akan tercampur di grid POS. Lihat ensureTenant() di lib/offline/db.ts.
      await ensureTenant(props.organizationId, props.outletId)

      await seedCatalog({
        products: props.initialProducts,
        categories: props.initialCategories,
        organizationId: props.organizationId,
        outletId: props.outletId,
      })
      await refreshLocal()

      const d = await getOrRegisterDevice(props.outletId, navigator.onLine)
      if (cancelled) return
      if ('error' in d) {
        setNotice(d.error)
        setDeviceFailed(true)
        return
      }
      setDevice(d)
      await refreshLocal()
      await pruneSynced()

      // Shift butuh jaringan. Kegagalannya tidak memblokir penjualan —
      // transaksi cukup tercatat tanpa shift dan dikaitkan belakangan.
      const shift = await ensureShift(d.id)
      if (!cancelled && 'id' in shift) setShiftId(shift.id)
    })()
    return () => {
      cancelled = true
    }
  }, [props.initialProducts, props.initialCategories, props.outletId, refreshLocal])

  // ---------- denyut sinkronisasi ----------
  const tick = useCallback(async () => {
    const isOnline = await pingServer(props.supabaseUrl)
    setOnline(isOnline)
    if (!isOnline || !device) return

    await flush(props.organizationId, device.id)
    await pullCatalog(props.organizationId, props.outletId)
    await refreshLocal()
  }, [device, props.organizationId, props.outletId, props.supabaseUrl, refreshLocal])

  useEffect(() => {
    if (!device) return
    void tick()
    const timer = setInterval(tick, 30_000)
    const onBack = () => void tick()
    window.addEventListener('online', onBack)
    window.addEventListener('focus', onBack)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onBack)
      window.removeEventListener('focus', onBack)
    }
  }, [device, tick])

  // ---------- daftar produk yang tampil ----------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'Semua' && p.category_name !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, category, query])

  // ---------- pindaian barcode ----------
  const tambah = useCallback(
    (p: CatalogEntry) =>
      cart.add({ productId: p.id, name: p.name, sku: p.sku, price: p.sell_price, stock: p.stock }),
    [cart],
  )

  /**
   * Terima hasil pindaian, dari kamera maupun alat pemindai USB/Bluetooth.
   *
   * Cocokkan BARCODE dulu, baru SKU. Alat pemindai berlaku seperti keyboard:
   * ia mengetik seluruh angka lalu menekan Enter, jadi tanpa penanganan ini
   * kasir harus menekan kartu produknya sendiri padahal barangnya sudah
   * dipindai. Sudah cocok, langsung masuk keranjang dan kotak cari dikosongkan
   * supaya barang berikutnya bisa segera dipindai.
   */
  const terimaPindaian = useCallback(
    (kode: string, bolehSku = false): boolean => {
      const k = kode.trim().toLowerCase()
      if (!k) return false
      /**
       * SKU hanya dicocokkan kalau DIMINTA, dan itu tidak pernah terjadi saat
       * kasir sedang mengetik.
       *
       * SKU di sini pendek dan mudah diketik penuh ("MNM-0005"). Kalau ikut
       * dicocokkan pada tiap ketikan, kasir yang mengetik SKU untuk MENCARI
       * barangnya malah menambahkannya ke keranjang tanpa diminta. Barcode
       * aman: panjang, angka semua, dan praktis tidak mungkin selesai diketik
       * kecuali memang sedang dipindai.
       */
      const p =
        products.find((x) => (x.barcode ?? '').toLowerCase() === k) ??
        (bolehSku ? products.find((x) => x.sku.toLowerCase() === k) : undefined)
      if (!p) return false
      tambah(p)
      setQuery('')
      setScanNotice(`${p.name} masuk keranjang.`)
      return true
    },
    [products, tambah],
  )

  /**
   * Fokus otomatis ke kotak cari HANYA di perangkat berpenunjuk halus (mouse).
   *
   * Di kasir meja, alat pemindai tidak berguna kalau fokusnya tidak di kotak
   * cari. Di ponsel fokus otomatis justru membuka papan ketik dan menutupi
   * setengah grid produk sebelum kasir sempat menyentuh apa pun.
   */
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus()
  }, [])

  // Pesan "masuk keranjang" hilang sendiri; kasir tidak perlu menutupnya.
  useEffect(() => {
    if (!scanNotice) return
    const t = setTimeout(() => setScanNotice(null), 2200)
    return () => clearTimeout(t)
  }, [scanNotice])

  // ---------- penukaran poin ----------
  /**
   * Poin yang benar-benar berlaku untuk keranjang saat ini, beserta rupiahnya.
   *
   * Dihitung ulang di sini dan bukan disimpan sebagai state, karena tiga hal
   * yang menentukannya bisa berubah kapan saja: isi keranjang, pelanggan yang
   * dipilih, dan angka yang diketik kasir. Menyimpan hasilnya berarti suatu
   * saat potongannya lebih besar daripada belanjaannya — dan tidak ada yang
   * memberi tahu sampai totalnya tercetak minus di struk.
   */
  const redeemInfo = useMemo(() => {
    const kosong = { poin: 0, potongan: 0 }
    if (!props.loyalty.enabled || !customer || props.loyalty.pointValue <= 0) return kosong
    const muat = Math.floor(cart.total() / props.loyalty.pointValue)
    const poin = Math.max(Math.min(redeem, customer.points, muat), 0)
    return { poin, potongan: poin * props.loyalty.pointValue }
  }, [cart, customer, redeem, props.loyalty])

  // ---------- pembayaran ----------
  async function handlePay(method: 'cash' | 'qris', paid: number) {
    // Dulu kondisi ini `return` diam-diam, sehingga tombol tersangkut di
    // "Menyimpan…" tanpa pesan apa pun dan tanpa jejak di server.
    if (!device) {
      throw new Error(
        'Perangkat kasir belum terdaftar. Pastikan sempat terhubung internet sekali, lalu muat ulang halaman.',
      )
    }
    if (cart.lines.length === 0) {
      throw new Error('Keranjang kosong.')
    }
    // Lapis kedua. Tombolnya sudah dikunci di atas, tapi jalur uang tidak boleh
    // bergantung pada satu penjagaan saja — server juga akan menolak, dan
    // penolakan itu harus punya kalimat yang bisa dibaca kasir.
    if (blocked) {
      throw new Error(
        'Langganan toko sedang tidak aktif, jadi penjualan baru belum bisa dicatat. ' +
          'Hubungi pemilik toko. Penjualan yang sudah tercatat sebelumnya tetap aman.',
      )
    }

    const now = new Date()
    const seq = await nextSequence(device.id)
    const bruto = cart.total()
    // Dijepit ulang di sini, bukan dipercaya dari state layar: keranjang bisa
    // berubah setelah poin diketik (mis. satu barang dibatalkan), dan potongan
    // yang lebih besar dari belanjaannya akan membuat totalnya minus.
    const poin = redeemInfo.poin
    const potongan = redeemInfo.potongan
    const total = Math.max(bruto - potongan, 0)

    const trx: OutboxTransaction = {
      id: newTransactionId(),
      code: buildTransactionCode(device.code, seq, now),
      organization_id: props.organizationId,
      outlet_id: props.outletId,
      device_id: device.id,
      shift_id: shiftId,
      cashier_name: props.cashierName,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? null,
      customer_phone: customer?.phone ?? null,
      client_created_at: now.toISOString(),
      payment_method: method,
      paid_amount: method === 'cash' ? paid : total,
      points_redeemed: poin,
      points_value: potongan,
      total,
      // Perangkat yang menentukan asal transaksi, bukan server.
      origin: online ? 'online' : 'offline',
      items: cart.lines.map((l) => ({
        product_id: l.productId,
        product_name: l.name,
        sku: l.sku,
        quantity: l.qty,
        unit_price: l.price,
        discount: 0,
      })),
      status: 'pending',
      attempts: 0,
      last_error: null,
      synced_at: null,
    }

    // Tulis ke antrean lokal DULU, baru tampilkan struk. Urutan ini yang
    // membuat transaksi tidak pernah hilang walau listrik mati sedetik
    // setelah kasir menerima uang.
    try {
      await enqueue(trx)
    } catch (e) {
      // Penyimpanan lokal gagal (kuota penuh, mode penyamaran, IndexedDB
      // diblokir). Jangan pernah menampilkan struk kalau transaksinya tidak
      // benar-benar tersimpan.
      throw new Error(
        'Transaksi gagal disimpan di perangkat: ' +
          (e instanceof Error ? e.message : String(e)) +
          '. Jangan serahkan barang sebelum dicoba ulang.',
      )
    }

    cart.clear()
    /**
     * Pelanggan DILEPAS setelah transaksi selesai.
     *
     * Sebelum ini pilihannya menempel sampai kasir melepasnya sendiri, dan
     * tidak ada apa pun di layar bayar yang mengingatkan. Akibatnya pembeli
     * berikutnya yang tidak terdaftar tetap tercatat atas nama pembeli
     * sebelumnya: belanjanya bertambah, kunjungannya bertambah, dan poinnya
     * ikut lahir. Satu antrean pagi cukup untuk mengacaukan seluruh data CRM.
     */
    setCustomer(null)
    setRedeem(0)
    setLastReceipt(trx)
    setModal('success')
    await refreshLocal()

    // Kirim di latar belakang — kasir tidak menunggu jaringan.
    void tick()
  }

  const total = cart.total()
  const cartCount = cart.count()

  return (
    <>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p className="page-eyebrow">
            {props.cashierName}
            {device ? ` · Perangkat ${device.code}` : ''}
          </p>
          <h1 className="page-title">Kasir</h1>
        </div>
        <SyncStatusChip
          online={online}
          pending={pending}
          lastSync={lastSync}
          onSync={() => void tick()}
        />
      </div>

      {notice && (
        <div className="empty-note" style={{ marginBottom: 14 }} role="alert">
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>{notice}</div>
        </div>
      )}

      {!online && (
        <div
          className="empty-note is-warn"
          style={{ marginBottom: 14 }}
        >
          <Icon name="wifiOff" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            Mode offline. Kasir tetap jalan. {pending > 0 ? `${pending} transaksi` : 'Transaksi'}{' '}
            akan terkirim otomatis saat internet kembali. Stok yang tampil adalah angka terakhir
            yang tersinkron.
          </div>
        </div>
      )}

      <div className={cn('pos-layout', cartCount > 0 && 'with-cart-bar')}>
        <div>
          <div className="scan-row">
            <div className="tf-input" style={{ flex: 1, minWidth: 0 }}>
              <Icon name="search" size={15} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  const v = e.target.value
                  // Pemindai yang tidak mengirim Enter tetap tertangkap: begitu
                  // ketikannya persis sama dengan sebuah barcode, produknya masuk.
                  // Tanpa SKU: lihat catatan di `terimaPindaian`.
                  if (v.length >= 8 && terimaPindaian(v)) return
                  setQuery(v)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  // Enter berarti kasir memang sudah selesai mengetik, jadi
                  // SKU boleh ikut dicocokkan di sini.
                  if (terimaPindaian(query, true)) return
                  // Bukan barcode, tapi kalau hasil carinya tinggal satu, itu
                  // yang dimaksud kasir.
                  if (visible.length === 1) {
                    tambah(visible[0])
                    setQuery('')
                    setScanNotice(`${visible[0].name} masuk keranjang.`)
                  }
                }}
                placeholder="Cari produk, SKU, atau scan barcode…"
                aria-label="Cari produk, SKU, atau barcode"
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost scan-btn"
              onClick={() => setScannerOpen(true)}
              aria-label="Pindai barcode dengan kamera"
              title="Pindai barcode dengan kamera"
            >
              <Icon name="scan" size={17} />
            </button>
          </div>

          {scanNotice && (
            <div className="scan-notice" role="status">
              <Icon name="check" size={14} />
              {scanNotice}
            </div>
          )}

          {scannerOpen && (
            <BarcodeScanner
              onClose={() => setScannerOpen(false)}
              onScan={(kode) => {
                const ketemu = terimaPindaian(kode)
                if (!ketemu) setScanNotice(`Barcode ${kode} tidak cocok dengan produk mana pun.`)
                return ketemu
              }}
            />
          )}

          <CategoryPills
            categories={['Semua', ...categories.map((c) => c.name)]}
            active={category}
            onChange={setCategory}
          />

          <ProductGrid
            products={visible}
            allowNegativeStock={props.allowNegativeStock}
            inCart={Object.fromEntries(cart.lines.map((l) => [l.productId, l.qty]))}
            onPick={tambah}
          />
        </div>

        <CartPanel
          lines={cart.lines}
          total={total}
          ready={!!device && !blocked}
          notReadyLabel={
            blocked
              ? 'Langganan tidak aktif'
              : deviceFailed
                ? 'Perangkat belum terdaftar'
                : 'Menyiapkan perangkat…'
          }
          onQty={cart.changeQty}
          onClear={cart.clear}
          onPay={() => setModal('pay')}
        />
      </div>

      <CartBar
        count={cartCount}
        total={total}
        ready={!!device}
        /* Sengaja gulir instan. Baik opsi `behavior: 'smooth'` maupun
           `scroll-behavior: smooth` di CSS diabaikan diam-diam di sini —
           tanpa error, tanpa gulir sama sekali — sehingga tombolnya terasa
           mati. Di jalur uang, sampai ke tujuan lebih penting dari animasi. */
        onReview={() => document.getElementById('keranjang')?.scrollIntoView()}
        onPay={() => setModal('pay')}
      />

      {modal === 'pay' && (
        <PaymentModal
          total={total}
          discount={redeemInfo.potongan}
          discountLabel={`Tukar ${redeemInfo.poin.toLocaleString('id-ID')} poin`}
          onClose={() => setModal(null)}
          onConfirm={handlePay}
          customerSlot={
            <CustomerPicker
              organizationId={props.organizationId}
              online={online}
              value={customer}
              onChange={(c) => {
                setCustomer(c)
                // Poin milik pelanggan sebelumnya. Dibawa ke pelanggan baru, ia
                // akan terjepit ke saldo yang ada — tapi angka di kotaknya
                // sudah terlanjur dibacakan kasir ke pembeli.
                setRedeem(0)
              }}
            />
          }
          redeemSlot={
            props.loyalty.enabled && customer ? (
              <PointRedeem
                customerName={customer.name}
                saldo={customer.points}
                pointValue={props.loyalty.pointValue}
                maxRupiah={total}
                value={redeemInfo.poin}
                onChange={setRedeem}
              />
            ) : null
          }
        />
      )}

      {modal === 'success' && lastReceipt && (
        <SuccessModal
          trx={lastReceipt}
          store={props.store}
          online={online}
          onClose={() => {
            setModal(null)
            setLastReceipt(null)
          }}
        />
      )}
    </>
  )
}
