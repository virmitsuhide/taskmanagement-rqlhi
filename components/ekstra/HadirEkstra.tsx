'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { simpanHadirEkstraAction } from '@/app/actions/ekstra'
import type { StatusHadirEkstra } from '@/lib/data/ekstra'

const STATUS: { kode: StatusHadirEkstra; label: string; kelas: string }[] = [
  { kode: 'hadir', label: 'H', kelas: 'bg-success text-white' },
  { kode: 'izin', label: 'I', kelas: 'bg-info text-info-foreground' },
  { kode: 'sakit', label: 'S', kelas: 'bg-warning text-warning-foreground' },
  { kode: 'alfa', label: 'A', kelas: 'bg-destructive text-white' },
]

/** Kehadiran satu pertemuan ekstra — bawaannya hadir, ubah yang tidak datang. */
export function HadirEkstra({ slotId, tanggal, peserta, awal }: {
  slotId: string
  tanggal: string
  peserta: { id: string; nama: string; ket: string }[]
  awal: Record<string, StatusHadirEkstra>
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const tersimpan = Object.keys(awal).length > 0
  const [isi, setIsi] = useState<Record<string, StatusHadirEkstra>>(
    () => Object.fromEntries(peserta.map(p => [p.id, awal[p.id] ?? 'hadir'])),
  )

  function simpan() {
    mulai(async () => {
      const r = await simpanHadirEkstraAction(slotId, tanggal, peserta.map(p => ({ booking_id: p.id, status: isi[p.id], catatan: '' })))
      if (r.error) toast.error(r.error)
      else { toast.success('Kehadiran tersimpan.'); router.refresh() }
    })
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border">
        {peserta.map(p => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.nama}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.ket}</span>
            </span>
            <span role="group" aria-label={`Kehadiran ${p.nama}`} className="flex gap-1">
              {STATUS.map(s => (
                <button key={s.kode} type="button" onClick={() => setIsi(v => ({ ...v, [p.id]: s.kode }))}
                  aria-pressed={isi[p.id] === s.kode} aria-label={s.kode}
                  className={cn('h-9 w-9 rounded-lg border text-xs font-bold', isi[p.id] === s.kode ? s.kelas : 'bg-card text-muted-foreground')}>
                  {s.label}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{tersimpan ? 'Sudah tersimpan — boleh diubah.' : 'Belum disimpan.'}</span>
        <Button onClick={simpan} disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan kehadiran'}</Button>
      </div>
    </div>
  )
}
