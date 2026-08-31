'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Scale, Send, Stamp } from 'lucide-react'
import { ajukanRaporAction } from '@/app/actions/kpi-rapor'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/kpi/alur'
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
  /** SDM & Kepala RQ — yang mengajukan rapor ke koordinator. */
  bisaAjukan: boolean
  /** Koordinator — punya mejanya sendiri. */
  bisaPublikasi: boolean
  bisaBanding: boolean
  unit: string
  year: number
  month: number
}

/**
 * Panel alur pengesahan di atas tabel KPI.
 *
 * Ditaruh di luar tabel dengan sengaja. Tabel KPI sudah selebar tujuh belas
 * kolom; menyelipkan kotak centang dan kolom status ke dalamnya akan mendorong
 * indikator ke luar layar pada perangkat mana pun, padahal justru indikatornya
 * yang dibaca sehari-hari. Yang dikerjakan di sini pun bukan penilaian
 * melainkan penyerahan dokumen — pekerjaan yang berbeda, sekali sebulan.
 */
export function AlurPanel({
  rows, bisaAjukan, bisaPublikasi, bisaBanding, unit, year, month,
}: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [pesan, setPesan] = useState<{ jenis: 'ok' | 'galat'; teks: string } | null>(null)

  const hitung = (s: KpiRaporStatus) => rows.filter(r => r.status === s).length
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

  if (rows.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Stamp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Alur pengesahan</span>
          {(['draft', 'diajukan', 'dikembalikan', 'terbit', 'banding', 'selesai'] as KpiRaporStatus[])
            .filter(s => hitung(s) > 0)
            .map(s => (
              <span key={s} className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_TONE[s])}>
                {hitung(s)} {STATUS_LABELS[s].toLowerCase()}
              </span>
            ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {bisaPublikasi && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/kpi/publikasi?unit=${unit}&year=${year}&month=${month}`}>
                <Stamp className="mr-1 h-4 w-4" />Meja Publikasi
              </Link>
            </Button>
          )}
          {bisaBanding && (
            <Button asChild size="sm" variant="outline">
              <Link href="/kpi/banding">
                <Scale className="mr-1 h-4 w-4" />Banding
              </Link>
            </Button>
          )}
          {bisaAjukan && siapDiajukan.length > 0 && (
            <Button size="sm" disabled={pending} onClick={ajukan}>
              <Send className="mr-1 h-4 w-4" />
              Ajukan ke Koordinator ({siapDiajukan.length})
            </Button>
          )}
        </div>
      </div>

      {pesan && (
        <div
          className={cn(
            'mt-2.5 flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
            pesan.jenis === 'ok'
              ? 'bg-success-wash text-success'
              : 'bg-destructive-wash text-destructive',
          )}
        >
          {pesan.jenis === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{pesan.teks}</span>
        </div>
      )}
    </div>
  )
}
