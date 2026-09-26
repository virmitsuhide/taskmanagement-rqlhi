'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Search, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tambahGuruEkstraAction, ubahGuruEkstraAction } from '@/app/actions/ekstra'

export interface BarisGuruEkstra {
  id: string
  nama: string
  unit: string
  aktif: boolean
  halaqoh: number
  peserta: number
}

/**
 * Kelola guru ekstra: daftar yang bersedia mengampu (bisa dinonaktifkan),
 * dan penambahan dari seluruh guru aktif lintas unit.
 */
export function KelolaGuruEkstra({ daftar, calon }: {
  daftar: BarisGuruEkstra[]
  /** Guru aktif yang belum ada di daftar. */
  calon: { id: string; nama: string; unit: string }[]
}) {
  const [pending, mulai] = useTransition()
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<string[]>([])

  const jalankan = (fn: () => Promise<{ error?: string }>, pesan: string, sesudah?: () => void) => mulai(async () => {
    const r = await fn()
    if (r.error) { toast.error(r.error); return }
    toast.success(pesan); sesudah?.()
  })

  const q = cari.trim().toLowerCase()
  const saring = useMemo(() => calon.filter(c => !q || c.nama.toLowerCase().includes(q) || c.unit.toLowerCase().includes(q)), [calon, q])
  const perUnit = useMemo(() => {
    const m = new Map<string, typeof saring>()
    for (const c of saring) m.set(c.unit, [...(m.get(c.unit) ?? []), c])
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [saring])

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="font-heading text-xl">Guru ekstra</h2>
          <p className="text-xs text-muted-foreground">
            {daftar.filter(d => d.aktif).length} menerima ekstra · hanya mereka yang bisa dibooking orang tua dan dijadikan pengampu halaqoh ekstra.
          </p>
        </div>
        {daftar.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada guru ekstra. Tambahkan dari daftar di samping.</p>
        ) : (
          <ul className="divide-y">
            {daftar.map(g => (
              <li key={g.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-2.5', !g.aktif && 'opacity-60')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.nama}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.unit} · {g.halaqoh} halaqoh · {g.peserta} peserta{!g.aktif && ' · tidak menerima ekstra'}
                  </span>
                </span>
                {g.aktif ? (
                  <Button size="sm" variant="outline" disabled={pending}
                    title={g.halaqoh ? 'Halaqoh yang sudah berjalan tetap berjalan; guru tidak lagi bisa dibooking' : undefined}
                    onClick={() => jalankan(() => ubahGuruEkstraAction(g.id, false), `${g.nama} tidak lagi menerima ekstra.`)}>
                    <UserMinus className="mr-1 h-3.5 w-3.5" />Nonaktifkan
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={pending}
                    onClick={() => jalankan(() => ubahGuruEkstraAction(g.id, true), `${g.nama} kembali menerima ekstra.`)}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" />Aktifkan
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="font-heading text-xl">Tambah guru ekstra</h2>
          <p className="text-xs text-muted-foreground">Dari semua guru aktif, lintas unit. Tambahkan guru yang sudah menyatakan bersedia.</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau unit" aria-label="Cari guru"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border">
            {perUnit.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">{calon.length === 0 ? 'Semua guru aktif sudah ada di daftar.' : 'Tidak ada guru yang cocok.'}</p>
            ) : perUnit.map(([unit, isi]) => (
              <div key={unit}>
                <p className="sticky top-0 bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{unit}</p>
                <ul>
                  {isi.map(c => (
                    <li key={c.id}>
                      <label className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50', pilih.includes(c.id) && 'bg-primary-wash font-semibold')}>
                        <input type="checkbox" className="h-4 w-4 accent-primary" checked={pilih.includes(c.id)}
                          onChange={() => setPilih(pilih.includes(c.id) ? pilih.filter(x => x !== c.id) : [...pilih, c.id])} />
                        <span className="min-w-0">{c.nama}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button type="button" className="w-full" disabled={pending || pilih.length === 0}
            onClick={() => jalankan(() => tambahGuruEkstraAction(pilih), `${pilih.length} guru ditambahkan.`, () => setPilih([]))}>
            <Plus className="mr-1.5 h-4 w-4" />{pilih.length ? `Tambahkan ${pilih.length} guru` : 'Pilih guru dulu'}
          </Button>
        </div>
      </section>
    </div>
  )
}
