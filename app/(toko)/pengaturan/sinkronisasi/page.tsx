import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/ui/icons'
import { requirePermission } from '@/lib/auth'
import { cn, jam, tanggal } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Sinkronisasi — TokoKu' }
export const dynamic = 'force-dynamic'

/** "3 jam lalu" — dipakai untuk menilai kesehatan perangkat sekilas. */
function sejak(iso: string | null): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (!iso) return { label: 'belum pernah', tone: 'bad' }
  const menit = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (menit < 60) return { label: `${Math.max(menit, 1)} mnt lalu`, tone: 'ok' }
  const jamLalu = Math.floor(menit / 60)
  if (jamLalu < 24) return { label: `${jamLalu} jam lalu`, tone: jamLalu > 6 ? 'warn' : 'ok' }
  return { label: `${Math.floor(jamLalu / 24)} hari lalu`, tone: 'bad' }
}

const TONE_BADGE = { ok: 'badge-active', warn: 'badge-trial', bad: 'badge-low' } as const

export default async function SinkronisasiPage() {
  const session = await requirePermission('settings')
  const supabase = await createClient()
  const orgId = session.org!.id

  // Disaring per OUTLET AKTIF, sama seperti seluruh aplikasi.
  //
  // Perangkat kasir terdaftar per outlet dan kodenya hanya unik DI DALAM satu
  // outlet — toko dua cabang wajar punya "K1" di masing-masing. Dicampur,
  // halaman ini menampilkan dua baris "Kasir K1" tanpa satu pun kolom yang
  // membedakannya, dan justru di sinilah perangkat dihapus. Salah pilih berarti
  // mencabut kasir cabang yang sedang berjualan.
  const [{ data: devices }, { data: rejections }, { data: batches }] = await Promise.all([
    supabase
      .from('v_sync_health')
      .select('device_id, device_name, code, last_sync_at, last_seen_at, open_rejections, offline_trx_7d, app_version')
      .eq('organization_id', orgId)
      .eq('outlet_id', session.outletId!)
      .order('code'),
    // SENGAJA tidak disaring per outlet — beda dengan perangkat dan riwayat
    // pengiriman di atas.
    //
    // `sync_rejections` memang tidak menyimpan outlet_id, tapi bukan itu
    // alasannya: tiap penolakan adalah penjualan yang gagal masuk, alias uang
    // yang hilang tanpa jejak. Disaring per cabang, pemilik yang sedang membuka
    // MAIN tidak akan pernah tahu ada transaksi Renon yang gagal — dan tidak ada
    // apa pun di layar yang memberi tahu bahwa ada yang disembunyikan.
    // Ketidakkonsistenan yang disengaja: gagal ke arah yang aman.
    supabase
      .from('sync_rejections')
      .select('id, client_trx_code, reason_code, reason, created_at, resolved_at')
      .eq('organization_id', orgId)
      .is('resolved_at', null)
      .neq('reason_code', 'warning')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('sync_batches')
      .select('id, received_at, item_count, accepted_count, duplicate_count, rejected_count')
      .eq('organization_id', orgId)
      .eq('outlet_id', session.outletId!)
      .order('received_at', { ascending: false })
      .limit(10),
  ])

  const perluPerhatian = (rejections ?? []).length
  // Disebut hanya kalau tokonya memang bercabang — kalau tidak, menyebut nama
  // outlet cuma mengulang nama toko yang sudah ada di brand.
  const outletName =
    session.outlets.length > 1
      ? (session.outlets.find((o) => o.id === session.outletId)?.name ?? null)
      : null

  return (
    <>
      <PageHeader
        eyebrow="Pengaturan"
        title="Sinkronisasi"
        subtitle={
          outletName
            ? `Perangkat kasir dan antrean transaksi di ${outletName}.`
            : 'Pantau perangkat kasir dan antrean transaksi yang belum terkirim.'
        }
      />

      {perluPerhatian > 0 && (
        <div className="empty-note" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            {perluPerhatian} transaksi gagal diterapkan dan menunggu ditinjau. Transaksinya
            tidak dibuang — datanya tersimpan utuh di bawah.
            {outletName && ' Daftar ini mencakup semua cabang, bukan hanya yang sedang dibuka.'}
          </div>
        </div>
      )}

      <div className="section-title">Perangkat Kasir</div>
      <div className="table-card">
        {(devices ?? []).length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada perangkat terdaftar. Perangkat mendaftar otomatis saat layar Kasir
            pertama kali dibuka.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Perangkat</th>
                  <th>Sinkron terakhir</th>
                  <th>Transaksi offline (7 hari)</th>
                  <th>Perlu ditinjau</th>
                </tr>
              </thead>
              <tbody>
                {(devices ?? []).map((d) => {
                  const s = sejak(d.last_sync_at)
                  return (
                    <tr key={d.device_id}>
                      <td>
                        <div className="cell-name">{d.device_name}</div>
                        <div className="cell-sub mono">
                          {d.code}
                          {d.app_version ? ` · ${d.app_version}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className={cn('badge', TONE_BADGE[s.tone])}>{s.label}</span>
                      </td>
                      <td>{d.offline_trx_7d ?? 0}</td>
                      <td>
                        {Number(d.open_rejections ?? 0) > 0 ? (
                          <span className="badge badge-low">{d.open_rejections}</span>
                        ) : (
                          <span style={{ color: 'var(--color-ink-faint)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {perluPerhatian > 0 && (
        <>
          <div className="section-title">Perlu Ditinjau</div>
          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Sebab</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {(rejections ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {r.client_trx_code ?? '—'}
                      </td>
                      <td>
                        <div className="cell-name">{r.reason_code}</div>
                        <div className="cell-sub">{r.reason}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-ink-faint)' }}>
                        {tanggal(r.created_at)} {jam(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="section-title">Riwayat Pengiriman</div>
      <div className="table-card">
        {(batches ?? []).length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>
            Belum ada pengiriman.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Dikirim</th>
                  <th>Diterima</th>
                  <th>Duplikat</th>
                  <th>Ditolak</th>
                </tr>
              </thead>
              <tbody>
                {(batches ?? []).map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {tanggal(b.received_at)} {jam(b.received_at)}
                    </td>
                    <td>{b.item_count}</td>
                    <td>{b.accepted_count}</td>
                    <td style={{ color: 'var(--color-ink-faint)' }}>{b.duplicate_count}</td>
                    <td>
                      {Number(b.rejected_count) > 0 ? (
                        <span className="badge badge-low">{b.rejected_count}</span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-faint)' }}>0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
