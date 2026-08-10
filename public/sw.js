/**
 * Service worker TokoKu.
 *
 * Tanpa ini, mode offline hanya bertahan selama tab tidak disentuh: begitu
 * kasir menekan reload atau perangkat tidur lalu bangun, halaman /kasir tidak
 * bisa dimuat sama sekali dan seluruh antrean jadi tidak terjangkau.
 *
 * Ditulis tangan, tanpa pustaka: yang dibutuhkan hanya tiga aturan, dan
 * satu-satunya bagian yang benar-benar penting adalah TIDAK PERNAH meng-cache
 * panggilan API — jawaban basi untuk stok atau transaksi jauh lebih berbahaya
 * daripada tidak ada jawaban.
 */
const VERSION = 'tokoku-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

const isApi = (url) =>
  url.hostname.endsWith('supabase.co') ||
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/_next/data/')

const isStatic = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  /\.(?:css|js|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin && !isStatic(url)) return

  // 1. API — selalu ke jaringan, tidak pernah di-cache.
  if (isApi(url)) return

  // 2. Aset statis — cache dulu; nama filenya sudah ber-hash jadi aman selamanya.
  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) (await caches.open(ASSETS)).put(request, res.clone())
        return res
      })(),
    )
    return
  }

  // 3. Navigasi halaman — jaringan dulu, jatuh ke salinan terakhir saat offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request)
          if (res.ok) (await caches.open(SHELL)).put(request, res.clone())
          return res
        } catch {
          const cached = await caches.match(request, { ignoreSearch: true })
          if (cached) return cached

          // Halaman ini belum pernah dibuka saat online.
          return new Response(
            `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
             <title>Offline — TokoKu</title>
             <style>body{font-family:system-ui,sans-serif;background:#FAFBF6;color:#17231C;
             display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
             div{max-width:340px;text-align:center}h1{font-size:18px;margin:0 0 8px}
             p{font-size:13px;color:#5B6B60;line-height:1.6}
             a{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:11px;
             background:linear-gradient(135deg,#F9F586,#A1FFCE);color:#0E2419;font-weight:700;
             text-decoration:none;font-size:13px}</style>
             <div><h1>Sedang offline</h1>
             <p>Halaman ini belum pernah dibuka saat ada internet, jadi belum tersimpan di perangkat.
             Layar Kasir tetap bisa dipakai kalau sudah pernah dibuka sebelumnya.</p>
             <a href="/kasir">Buka Kasir</a></div>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
          )
        }
      })(),
    )
  }
})
