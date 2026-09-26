'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { cariSiswaEkstraAction } from '@/app/actions/ekstra'
import type { CalonSiswa } from '@/lib/data/ekstra'

const label = (c: CalonSiswa) => `${c.full_name}${c.kelas ? ` · ${c.kelas}` : ''} · ${c.jenjang.toUpperCase()}`

/**
 * Pilih data siswa untuk ditautkan: daftar calon yang disarankan (nama mirip,
 * kelas sama diutamakan) + kolom cari bila anaknya tidak ada di saran —
 * ejaan orang tua sering jauh dari data sekolah.
 */
export function PilihSiswa({ id, calon, value, onChange, kosong = '— Pilih data siswa —' }: {
  id: string
  calon: CalonSiswa[]
  value: string
  onChange: (v: string) => void
  kosong?: string
}) {
  const [pending, mulai] = useTransition()
  const [q, setQ] = useState('')
  const [temuan, setTemuan] = useState<CalonSiswa[] | null>(null)

  const cari = () => mulai(async () => {
    const r = await cariSiswaEkstraAction(q)
    if (r.error) { toast.error(r.error); return }
    const hasil = r.hasil ?? []
    setTemuan(hasil)
    if (hasil.length === 0) toast.info('Tidak ada siswa aktif dengan nama itu.')
    else onChange(hasil[0].id)
  })

  // Hasil pencarian di atas, lalu saran awal yang belum ada di hasil.
  const opsi = [...(temuan ?? []), ...calon.filter(c => !temuan?.some(t => t.id === c.id))]

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <select id={id} value={value} onChange={e => onChange(e.target.value)} aria-label="Data siswa"
        className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm">
        <option value="">{opsi.length ? kosong : '— Tidak ada nama yang mirip, cari di bawah —'}</option>
        {opsi.map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}
      </select>
      <div className="flex min-w-0 gap-1.5">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama siswa lain…" aria-label="Cari nama siswa"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); cari() } }}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
        <button type="button" onClick={cari} disabled={pending || q.trim().length < 2}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-card px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
          <Search className="h-3.5 w-3.5" />{pending ? 'Mencari…' : 'Cari'}
        </button>
      </div>
    </div>
  )
}
