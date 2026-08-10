/**
 * Kerangka halaman selagi data dijemput dari server.
 *
 * Bentuknya sengaja mengikuti kerangka halaman yang paling umum di aplikasi
 * ini — judul, satu blok besar, lalu deretan kartu — bukan gambaran persis
 * satu halaman tertentu. Kerangka yang meniru terlalu tepat justru terasa
 * salah begitu halaman aslinya muncul dengan susunan berbeda.
 *
 * Tidak ada teks "Memuat…": yang dicari mata saat menunggu adalah bentuk
 * halaman yang akan datang, dan kata itu tidak menambahkan apa pun yang tidak
 * sudah disampaikan oleh kerangkanya sendiri.
 */
export function PageSkeleton({ hero = true }: { hero?: boolean }) {
  return (
    <div aria-hidden="true">
      <div className="page-head">
        <div className="skeleton skeleton-line" style={{ width: 90, height: 10, marginBottom: 8 }} />
        <div className="skeleton skeleton-title" />
      </div>

      {hero && <div className="skeleton skeleton-hero" />}

      <div className="grid grid-stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="card" key={i}>
            <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 12 }} />
            <div className="skeleton skeleton-line" style={{ width: '55%', marginTop: 14 }} />
            <div
              className="skeleton skeleton-line"
              style={{ width: '75%', height: 10, marginTop: 8 }}
            />
          </div>
        ))}
      </div>

      <div className="section-title">
        <div className="skeleton skeleton-line" style={{ width: 140, height: 14 }} />
      </div>
      <div className="table-card" style={{ padding: 18 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              paddingBlock: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="skeleton skeleton-line" style={{ width: '45%' }} />
              <div
                className="skeleton skeleton-line"
                style={{ width: '30%', height: 10, marginTop: 7 }}
              />
            </div>
            <div className="skeleton skeleton-line" style={{ width: 78 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
