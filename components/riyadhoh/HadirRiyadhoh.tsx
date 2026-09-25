'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { simpanHadirRiyadhohAction } from '@/app/actions/riyadhoh'
import type { StatusHadir } from '@/lib/data/riyadhoh'
import { cn } from '@/lib/utils'

interface Peserta {
  id: string
  nama: string
  kelas: string | null
  halaqoh: string | null
  /** Sudah punya setoran Riyadhoh tahsin / tahfidz pada Sabtu ini. */
  tahsin: boolean
  tahfidz: boolean
}

const STATUS: { kode: StatusHadir; label: string; kelas: string }[] = [
  { kode: 'hadir', label: 'H', kelas: 'bg-success text-white' },
  { kode: 'izin', label: 'I', kelas: 'bg-info text-info-foreground' },
  { kode: 'sakit', label: 'S', kelas: 'bg-warning text-warning-foreground' },
  { kode: 'alfa', label: 'A', kelas: 'bg-destructive text-white' },
]

/** Kehadiran satu Sabtu — satu ketuk per anak, disimpan sekaligus. */
export function HadirRiyadhoh({ tanggal, peserta, hadir, terkunci }: {
  tanggal: string
  peserta: Peserta[]
  hadir: Record<string, StatusHadir>
  terkunci: boolean
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [isi, setIsi] = useState<Record<string, StatusHadir | null>>(() => Object.fromEntries(peserta.map(p => [p.id, hadir[p.id] ?? null])))
  const berubah = peserta.filter(p => (isi[p.id] ?? null) !== (hadir[p.id] ?? null))
  const jumlahHadir = peserta.filter(p => isi[p.id] === 'hadir').length

  function simpan() {
    mulai(async () => {
      const hasil = await simpanHadirRiyadhohAction(tanggal, Object.fromEntries(berubah.map(p => [p.id, isi[p.id] ?? null])))
      if (hasil.error) toast.error(hasil.error)
      else { toast.success('Kehadiran tersimpan.'); router.refresh() }
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-medium">Kehadiran <span className="font-normal text-muted-foreground">· {jumlahHadir}/{peserta.length} hadir</span></h2>
        {!terkunci && (
          <Button size="sm" variant="outline" onClick={() => setIsi(v => Object.fromEntries(peserta.map(p => [p.id, v[p.id] ?? 'hadir'])))}>
            Sisanya hadir
          </Button>
        )}
      </div>

      <ul className="divide-y rounded-lg border">
        {peserta.map(p => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.nama}</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{p.kelas ?? '—'}{p.halaqoh ? ` · ${p.halaqoh}` : ''}</span>
                {p.tahsin && <span className="inline-flex items-center gap-0.5 text-success"><BookOpen className="size-3" />tahsin</span>}
                {p.tahfidz && <span className="inline-flex items-center gap-0.5 text-success"><Sparkles className="size-3" />tahfidz</span>}
              </p>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={`Kehadiran ${p.nama}`}>
              {STATUS.map(s => (
                <button
                  key={s.kode}
                  type="button"
                  role="radio"
                  aria-checked={isi[p.id] === s.kode}
                  aria-label={s.kode}
                  title={s.kode}
                  disabled={terkunci}
                  onClick={() => setIsi(v => ({ ...v, [p.id]: v[p.id] === s.kode ? null : s.kode }))}
                  className={cn(
                    'size-8 rounded-md border text-xs font-bold transition-colors disabled:opacity-40',
                    isi[p.id] === s.kode ? cn(s.kelas, 'border-transparent') : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {!terkunci && (
        <div className="flex justify-end">
          <Button onClick={simpan} disabled={pending || berubah.length === 0}>
            {pending ? 'Menyimpan…' : `Simpan kehadiran${berubah.length ? ` (${berubah.length})` : ''}`}
          </Button>
        </div>
      )}
    </section>
  )
}
