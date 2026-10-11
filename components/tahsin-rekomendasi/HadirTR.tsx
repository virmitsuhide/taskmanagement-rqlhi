'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { simpanHadirTRAction } from '@/app/actions/tahsin-rekomendasi'
import type { StatusHadirTR } from '@/lib/data/tahsin-rekomendasi'
import { LABEL_STATUS_TAHSIN } from '@/lib/rq/status-tahsin'
import { cn } from '@/lib/utils'

interface Peserta {
  id: string
  nama: string
  kelas: string | null
  /** Posisi tahsin sekarang ("Jilid 2 hal. 31") — maju oleh setoran sekolah maupun TR. */
  posisi: string | null
  /** Setoran TR Jum'at ini, sudah diformat di server. */
  setoran: { teks: string; status: string | null; bintang: string }[]
}

const STATUS: { kode: StatusHadirTR; label: string; kelas: string }[] = [
  { kode: 'hadir', label: 'H', kelas: 'bg-primary text-primary-foreground' },
  { kode: 'izin', label: 'I', kelas: 'bg-info text-info-foreground' },
  { kode: 'sakit', label: 'S', kelas: 'bg-warning text-warning-foreground' },
  { kode: 'alfa', label: 'A', kelas: 'bg-destructive text-white' },
]

/** Kehadiran satu Jum'at — satu ketuk per anak, disimpan sekaligus. */
export function HadirTR({ tanggal, peserta, hadir }: {
  tanggal: string
  peserta: Peserta[]
  hadir: Record<string, StatusHadirTR>
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  // Anak yang belum dicatat tampil 'hadir' sebagai bawaan — dan dihitung
  // BELUM tersimpan, supaya kelompok yang hadir semua cukup satu ketukan.
  const [isi, setIsi] = useState<Record<string, StatusHadirTR | null>>(
    () => Object.fromEntries(peserta.map(p => [p.id, hadir[p.id] ?? 'hadir'])),
  )
  const berubah = peserta.filter(p => (isi[p.id] ?? null) !== (hadir[p.id] ?? null))
  const belumDicatat = peserta.filter(p => !hadir[p.id]).length
  const jumlahHadir = peserta.filter(p => isi[p.id] === 'hadir').length

  function simpan() {
    mulai(async () => {
      const hasil = await simpanHadirTRAction(tanggal, Object.fromEntries(berubah.map(p => [p.id, isi[p.id] ?? null])))
      if (hasil.error) toast.error(hasil.error)
      else { toast.success('Kehadiran tersimpan.'); router.refresh() }
    })
  }

  return (
    <section id="kehadiran" className="scroll-mt-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 className="font-heading text-xl">Kehadiran &amp; setoran</h2>
        <span className="text-xs font-semibold text-primary tabular-nums">{jumlahHadir}/{peserta.length} hadir</span>
      </div>
      {belumDicatat > 0 && (
        <p className="mt-2 rounded-lg bg-warning-wash px-3 py-1.5 text-xs text-warning">
          {belumDicatat} anak belum disimpan — bawaannya hadir
        </p>
      )}

      <ul className="divide-y">
        {peserta.map(p => {
          const status = isi[p.id]
          const tidakDatang = status === 'izin' || status === 'sakit' || status === 'alfa'
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-bold">{p.nama}</span>
                  <span className="text-muted-foreground">{p.kelas ? ` · ${p.kelas}` : ''}</span>
                </p>
                <p className="text-xs text-muted-foreground">{p.posisi ? `Posisi kini: ${p.posisi}` : 'Belum punya posisi tahsin'}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {p.setoran.map((c, i) => (
                    <span key={i} className={cn('inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                      c.status === 'ulang' ? 'bg-accent-warm-wash text-accent-warm' : 'bg-primary-wash text-primary')}>
                      <span className="truncate">{c.teks}</span>
                      {c.status && <span className="font-normal opacity-80">· {LABEL_STATUS_TAHSIN[c.status as keyof typeof LABEL_STATUS_TAHSIN] ?? c.status}</span>}
                      {c.bintang && <span className="shrink-0 text-warning">{c.bintang}</span>}
                    </span>
                  ))}
                  {p.setoran.length === 0 && !tidakDatang && (
                    <span className="rounded-md bg-accent-warm-wash px-1.5 py-0.5 text-[11px] font-semibold text-accent-warm">Belum setor</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Kehadiran ${p.nama}`}>
                {STATUS.map(s => (
                  <button
                    key={s.kode}
                    type="button"
                    role="radio"
                    aria-checked={status === s.kode}
                    aria-label={s.kode}
                    title={s.kode}
                    onClick={() => setIsi(v => ({ ...v, [p.id]: v[p.id] === s.kode ? null : s.kode }))}
                    className={cn(
                      'size-9 rounded-lg border text-xs font-bold transition-colors',
                      status === s.kode ? cn(s.kelas, 'border-transparent') : 'bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <Button className="mt-2 h-11 w-full rounded-xl" onClick={simpan} disabled={pending || berubah.length === 0}>
        {pending ? 'Menyimpan…' : berubah.length ? `Simpan kehadiran (${berubah.length})` : 'Kehadiran tersimpan ✓'}
      </Button>
    </section>
  )
}
