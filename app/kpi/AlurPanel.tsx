'use client'

import { Fragment, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ChevronRight, Scale, Send, Stamp } from 'lucide-react'
import { ajukanRaporAction } from '@/app/actions/kpi-rapor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { KpiRaporStatus } from '@/types'

export interface RingkasAlur {
  kpiId: string
  fullName: string
  status: KpiRaporStatus
}

interface Props {
  rows: RingkasAlur[]
  /** Guru aktif yang belum punya baris rapor bulan ini. */
  belumDinilai: number
  /** SDM & Kepala RQ — yang mengajukan rapor ke koordinator. */
  bisaAjukan: boolean
  /** Koordinator — punya mejanya sendiri. */
  bisaPublikasi: boolean
  bisaBanding: boolean
  unit: string
  year: number
  month: number
  /** Tautan saringan daftar untuk tiap tahap (kunci: 'belum' atau status). */
  hrefTahap: Record<string, string>
}

const TAHAP: { kunci: 'belum' | KpiRaporStatus; label: string; kelas: string }[] = [
  { kunci: 'belum', label: 'Belum dinilai', kelas: 'bg-accent-warm-wash text-accent-warm' },
  { kunci: 'draft', label: 'Draf', kelas: 'bg-muted text-foreground' },
  { kunci: 'diajukan', label: 'Menunggu koordinator', kelas: 'bg-info-wash text-info' },
  { kunci: 'dikembalikan', label: 'Dikembalikan', kelas: 'bg-destructive-wash text-destructive' },
  { kunci: 'terbit', label: 'Dipublikasikan', kelas: 'bg-primary-wash text-primary' },
  { kunci: 'banding', label: 'Banding', kelas: 'bg-warning-wash text-warning' },
  { kunci: 'selesai', label: 'Selesai', kelas: 'bg-success-wash text-success' },
]

/**
 * Alur rapor bulan ini sebagai pita tahap: berapa guru di tiap tahap, dan
 * tombol mengajukan semua draf ke koordinator. Tiap tahap juga saringan
 * daftar guru di bawahnya.
 */
export function AlurPanel({
  rows, belumDinilai, bisaAjukan, bisaPublikasi, bisaBanding, unit, year, month, hrefTahap,
}: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [pesan, setPesan] = useState<{ jenis: 'ok' | 'galat'; teks: string } | null>(null)

  const hitung = (s: 'belum' | KpiRaporStatus) => (s === 'belum' ? belumDinilai : rows.filter(r => r.status === s).length)
  const siapDiajukan = rows.filter(r => r.status === 'draft' || r.status === 'dikembalikan')

  const ajukan = () =>
    start(async () => {
      const hasil = await ajukanRaporAction(siapDiajukan.map(r => r.kpiId))
      if ('error' in hasil) setPesan({ jenis: 'galat', teks: hasil.error })
      else {
        setPesan({
          jenis: 'ok',
          teks: `${hasil.jumlah} rapor diajukan ke koordinator unit. Mereka yang menandatangani & menerbitkannya kepada guru.`,
        })
        router.refresh()
      }
    })

  if (rows.length === 0 && belumDinilai === 0) return null

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-wash text-primary"><Stamp className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl leading-tight">Alur rapor bulan ini</h2>
          <p className="text-xs text-muted-foreground">SDM mengisi &amp; mengajukan · koordinator menandatangani &amp; menerbitkan · guru boleh banding</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bisaPublikasi && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/kpi/publikasi?unit=${unit}&year=${year}&month=${month}`}><Stamp className="mr-1 h-4 w-4" />Meja publikasi</Link>
            </Button>
          )}
          {bisaBanding && (
            <Button asChild size="sm" variant="outline">
              <Link href="/kpi/banding"><Scale className="mr-1 h-4 w-4" />Banding{hitung('banding') ? ` · ${hitung('banding')}` : ''}</Link>
            </Button>
          )}
          {bisaAjukan && siapDiajukan.length > 0 && (
            <Button size="sm" disabled={pending} onClick={ajukan}>
              <Send className="mr-1 h-4 w-4" />Ajukan {siapDiajukan.length} draf ke koordinator
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-stretch lg:gap-1.5">
        {TAHAP.map((t, i) => (
          <Fragment key={t.kunci}>
            <Link href={hrefTahap[t.kunci] ?? '#'}
              className={cn('flex min-w-0 flex-1 flex-col rounded-xl px-3.5 py-3 transition-opacity hover:opacity-85', t.kelas, hitung(t.kunci) === 0 && 'opacity-50')}>
              <span className="font-heading text-[28px] leading-none tabular-nums">{hitung(t.kunci)}</span>
              <span className="mt-1 text-xs font-bold leading-snug">{t.label}</span>
            </Link>
            {i < TAHAP.length - 1 && <ChevronRight className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground lg:block" aria-hidden />}
          </Fragment>
        ))}
      </div>

      {pesan && (
        <div className={cn('mt-3 flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
          pesan.jenis === 'ok' ? 'bg-success-wash text-success' : 'bg-destructive-wash text-destructive')}>
          {pesan.jenis === 'ok' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{pesan.teks}</span>
        </div>
      )}
    </section>
  )
}

/** Mengajukan satu rapor — dipakai di rincian baris guru. */
export function AjukanSatu({ kpiId }: { kpiId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [galat, setGalat] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const h = await ajukanRaporAction([kpiId])
        if ('error' in h) setGalat(h.error)
        else router.refresh()
      })}>
        <Send className="mr-1 h-3.5 w-3.5" />Ajukan rapor ini
      </Button>
      {galat && <span className="text-[11px] text-destructive">{galat}</span>}
    </span>
  )
}
