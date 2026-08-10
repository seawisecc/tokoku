import { envChecks, isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type DbState =
  | { state: 'no-env' }
  | { state: 'unreachable'; detail: string }
  | { state: 'no-schema'; detail: string }
  | { state: 'ready'; plans: { code: string; name: string; price_monthly: number }[] }

/**
 * Menempuh jalur yang sama persis dengan halaman asli nanti: klien server
 * + anon key + RLS. Kalau halaman ini hijau, koneksi aplikasi benar-benar
 * bekerja — bukan sekadar variabel lingkungan terisi.
 */
async function checkDatabase(): Promise<DbState> {
  if (!isSupabaseConfigured()) return { state: 'no-env' }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('plans')
      .select('code, name, price_monthly')
      .order('sort_order')

    if (error) {
      // Terhubung, tapi tabelnya belum ada → migrasi belum dijalankan.
      // PGRST205 = PostgREST tidak menemukan tabel di schema cache (jawaban paling umum);
      // 42P01 = error Postgres mentah, muncul lewat RPC.
      const missing =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message.includes('does not exist') ||
        error.message.includes('schema cache')
      return missing
        ? { state: 'no-schema', detail: error.message }
        : { state: 'unreachable', detail: `${error.code ?? ''} ${error.message}`.trim() }
    }

    return { state: 'ready', plans: data ?? [] }
  } catch (e) {
    return { state: 'unreachable', detail: e instanceof Error ? e.message : String(e) }
  }
}

const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' }) {
  const color =
    tone === 'ok' ? 'var(--color-success)' : tone === 'warn' ? '#B7860B' : 'var(--color-coral)'
  return (
    <span
      aria-hidden
      style={{
        width: 9,
        height: 9,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
        flex: '0 0 auto',
      }}
    />
  )
}

export default async function StatusPenyiapanPage() {
  const db = await checkDatabase()
  const env = envChecks()

  const headline: Record<DbState['state'], { tone: 'ok' | 'warn' | 'bad'; text: string }> = {
    'no-env': { tone: 'bad', text: 'Belum terhubung — .env.local belum diisi' },
    unreachable: { tone: 'bad', text: 'Gagal menghubungi Supabase' },
    'no-schema': { tone: 'warn', text: 'Terhubung — tapi migrasi belum dijalankan' },
    ready: { tone: 'ok', text: 'Terhubung ke Supabase' },
  }
  const status = headline[db.state]

  return (
    <main style={{ minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* ---------- brand ---------- */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div
            className="bg-grad"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--color-forest)',
              fontSize: 18,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            T
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: '-0.01em',
              }}
            >
              TokoKu
            </div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              by Seawise Studio
            </div>
          </div>
        </header>

        {/* ---------- status utama ---------- */}
        <section
          className={status.tone === 'ok' ? 'bg-grad' : undefined}
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '26px 22px',
            marginBottom: 20,
            background: status.tone === 'ok' ? undefined : 'var(--color-card)',
            border: status.tone === 'ok' ? 'none' : '1px solid var(--color-line)',
            color: status.tone === 'ok' ? 'var(--color-forest)' : 'var(--color-ink)',
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              opacity: 0.7,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {status.tone !== 'ok' && <Dot tone={status.tone} />}
            Status Penyiapan
          </div>
          <h1
            style={{
              fontSize: 'clamp(22px, 5vw, 30px)',
              fontWeight: 800,
              margin: '8px 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            {status.text}
          </h1>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            Halaman ini sementara. Akan diganti oleh alur login begitu modul auth (fase 2)
            selesai.
          </p>
        </section>

        {/* ---------- variabel lingkungan ---------- */}
        <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: '22px 0 10px' }}>
          Variabel Lingkungan
        </h2>
        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 18px',
          }}
        >
          {env.map((c) => {
            const filled = Boolean(c.value)
            return (
              <div
                key={c.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 0',
                  borderBottom: '1px solid var(--color-line)',
                }}
              >
                <Dot tone={filled ? 'ok' : c.required ? 'bad' : 'warn'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>
                    {c.key}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-ink-faint)' }}>
                    {filled ? c.hint : `Belum diisi — ${c.hint}`}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    background: filled
                      ? 'var(--color-success-soft)'
                      : c.required
                        ? 'var(--color-coral-soft)'
                        : 'var(--color-amber-soft)',
                    color: filled
                      ? 'var(--color-success)'
                      : c.required
                        ? 'var(--color-coral)'
                        : 'var(--color-amber-ink)',
                  }}
                >
                  {filled ? 'Terisi' : c.required ? 'Wajib' : 'Opsional'}
                </span>
              </div>
            )
          })}
        </div>

        {/* ---------- database ---------- */}
        <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: '22px 0 10px' }}>Database</h2>
        <div
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: 18,
          }}
        >
          {db.state === 'ready' && (
            <>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--color-ink-soft)' }}>
                Tabel <code style={{ fontFamily: 'var(--font-mono)' }}>plans</code> terbaca lewat
                anon key dan RLS. {db.plans.length} paket ditemukan.
              </p>
              {db.plans.map((p) => (
                <div
                  key={p.code}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: '1px dashed var(--color-line)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--color-ink-soft)' }}>{p.name}</span>
                  <span style={{ fontWeight: 700 }}>{rupiah(p.price_monthly)}/bln</span>
                </div>
              ))}
            </>
          )}

          {db.state === 'no-env' && (
            <Steps
              title="Isi kredensial Supabase"
              steps={[
                'cp .env.local.example .env.local',
                'Buka dashboard Supabase → Project Settings → Data API',
                'Salin Project URL dan anon key ke .env.local',
                'Jalankan ulang: npm run dev',
              ]}
            />
          )}

          {db.state === 'no-schema' && (
            <Steps
              title="Jalankan migrasi"
              steps={[
                'supabase link --project-ref <project-ref>',
                'supabase db push',
                'Muat ulang halaman ini',
              ]}
              detail={db.detail}
            />
          )}

          {db.state === 'unreachable' && (
            <Steps
              title="Periksa URL & kunci"
              steps={[
                'Pastikan NEXT_PUBLIC_SUPABASE_URL persis seperti di dashboard (termasuk https://)',
                'Pastikan anon key disalin utuh, tanpa spasi di ujung',
                'Cek project Supabase tidak sedang di-pause',
              ]}
              detail={db.detail}
            />
          )}
        </div>

        <footer
          style={{
            marginTop: 32,
            paddingTop: 18,
            borderTop: '1px solid var(--color-line)',
            fontSize: 12,
            color: 'var(--color-ink-faint)',
          }}
        >
          TokoKu — POS &amp; ERP retail UMKM · <strong>by Seawise Studio</strong>
        </footer>
      </div>
    </main>
  )
}

function Steps({
  title,
  steps,
  detail,
}: {
  title: string
  steps: string[]
  detail?: string
}) {
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{title}</div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-ink-soft)' }}>
        {steps.map((s) => (
          <li key={s} style={{ marginBottom: 7, lineHeight: 1.5 }}>
            {s.includes(' ') && !s.startsWith('supabase') && !s.startsWith('cp') ? (
              s
            ) : (
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: 'var(--color-paper)',
                  padding: '2px 6px',
                  borderRadius: 6,
                }}
              >
                {s}
              </code>
            )}
          </li>
        ))}
      </ol>
      {detail && (
        <p
          style={{
            marginTop: 14,
            marginBottom: 0,
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-faint)',
            background: 'var(--color-paper)',
            padding: '10px 12px',
            borderRadius: 10,
            wordBreak: 'break-word',
          }}
        >
          {detail}
        </p>
      )}
    </>
  )
}
