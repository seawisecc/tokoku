'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCategory, saveCategory } from '@/app/(toko)/pengaturan/actions'
import { IconAction } from '@/components/data/IconAction'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/format'

export type CategoryRow = { id: string; name: string; colorKey: string; productCount: number }

const COLORS = [
  { key: 'sembako', label: 'Kuning' },
  { key: 'minuman', label: 'Hijau' },
  { key: 'snack', label: 'Koral' },
  { key: 'kebutuhan', label: 'Biru' },
  { key: 'default', label: 'Abu' },
]

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState('default')
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await saveCategory(editing, name, color)
      if (!res.ok) {
        setNotice({ tone: 'bad', text: res.error })
        return
      }
      setNotice(null)
      setName('')
      setColor('default')
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="card form-narrow" style={{ marginBottom: 16 }}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="catName">{editing ? 'Ubah nama kategori' : 'Kategori baru'}</label>
            <input
              id="catName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mis. Rokok, Es Krim, Alat Tulis"
            />
          </div>
          <div className="field">
            <label htmlFor="catColor">Warna</label>
            <select id="catColor" value={color} onChange={(e) => setColor(e.target.value)}>
              {COLORS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className={cn('cat-chip', `cat-${color}`)}>
            {(name || '??').slice(0, 2).toUpperCase()}
          </div>
          <button className="btn btn-dark btn-sm" type="button" disabled={pending} onClick={submit}>
            {pending ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Tambah Kategori'}
          </button>
          {editing && (
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setEditing(null)
                setName('')
                setColor('default')
              }}
            >
              Batal
            </button>
          )}
        </div>

        {notice && (
          <div
            className="empty-note"
            style={
              notice.tone === 'ok'
                ? { marginTop: 14, background: 'var(--color-success-soft)', color: 'var(--color-success)' }
                : { marginTop: 14 }
            }
            role="alert"
          >
            <Icon name={notice.tone === 'ok' ? 'check' : 'alert'} size={16} style={{ marginTop: 1 }} />
            <div style={{ flex: 1 }}>{notice.text}</div>
          </div>
        )}
      </div>

      <div className="table-card">
        {categories.length === 0 ? (
          <div className="placeholder-card" style={{ border: 'none' }}>Belum ada kategori.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Produk</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="row-flex">
                        <div className={cn('cat-chip', `cat-${c.colorKey}`)}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="cell-name">{c.name}</div>
                      </div>
                    </td>
                    <td>{c.productCount}</td>
                    <td>
                      <div className="row-actions">
                        <IconAction
                          icon="edit"
                          label="Edit"
                          onClick={() => {
                            setEditing(c.id)
                            setName(c.name)
                            setColor(c.colorKey)
                          }}
                        />
                        <IconAction
                          icon="trash"
                          label="Hapus"
                          danger
                          confirm
                          onClick={async () => {
                            const res = await deleteCategory(c.id)
                            if (!res.ok) setNotice({ tone: 'bad', text: res.error })
                            else {
                              setNotice(res.message ? { tone: 'ok', text: res.message } : null)
                              router.refresh()
                            }
                          }}
                        />
                      </div>
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
