import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * Kartu pratinjau saat tautan TokoKu dibagikan.
 *
 * WhatsApp, dan hampir semua aplikasi chat, membaca `og:image` lalu
 * menampilkannya sebagai kartu di atas tautannya. Tanpa ini yang muncul cuma
 * URL polos, dan tautan polos di grup WhatsApp terbaca seperti spam.
 *
 * 1200x630 adalah ukuran yang diminta hampir semua pembaca kartu. WhatsApp
 * memotongnya jadi kotak kecil di ponsel, jadi seluruh isi penting ditaruh di
 * TENGAH dan tulisannya dibuat besar: kartu yang cantik di Twitter tapi tidak
 * terbaca di WhatsApp gagal pada satu-satunya tempat yang dipakai pemilik
 * warung.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'TokoKu: POS & ERP retail UMKM'

export default function Image() {
  // Logo dibaca dari disk lalu disisipkan sebagai data URI. `ImageResponse`
  // tidak bisa menjangkau berkas lewat path relatif saat dirender.
  const logo = readFileSync(join(process.cwd(), 'public/brand/tokoku.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F9F586 0%, #A1FFCE 100%)',
          fontFamily: 'sans-serif',
          padding: 64,
        }}
      >
        {/* Alas putih, dan itu bukan hiasan: logonya bergradien lime -> mint,
            persis keluarga warna latar kartu ini. Ditaruh langsung di atasnya ia
            nyaris melebur dan yang tersisa cuma huruf T samar. Alas putih juga
            cara logo ini muncul di dalam aplikasi, jadi kartunya konsisten. */}
        <div
          style={{
            display: 'flex',
            background: '#FFFFFF',
            padding: 16,
            borderRadius: 38,
            boxShadow: '0 8px 30px rgba(14, 36, 25, 0.16)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse */}
          <img src={logoSrc} width={124} height={124} style={{ borderRadius: 28 }} alt="" />
        </div>

        <div
          style={{
            marginTop: 34,
            fontSize: 86,
            fontWeight: 800,
            color: '#0E2419',
            letterSpacing: -2,
          }}
        >
          TokoKu
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 34,
            fontWeight: 600,
            color: '#17231C',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Kasir yang tetap jalan saat internet mati
        </div>

        <div style={{ marginTop: 26, fontSize: 24, color: '#3C5A48', fontWeight: 600 }}>
          POS &amp; ERP retail UMKM · by Seawise Studio
        </div>
      </div>
    ),
    size,
  )
}
