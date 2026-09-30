'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
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
  /** Rincian setoran Sabtu ini, urut waktu dicatat (sudah diformat di server). */
  capaian?: {
    jenis: 'ziyadah' | 'murojaah_baru' | 'murojaah_lama' | 'murojaah' | 'tasmi' | 'tahsin'
    label: string
    teks: string
    bintang: string
    ulang: boolean
  }[]
  /** Tautan setor untuk anak ini (tahsin memilih anaknya; tahfidz ke formulir sesi). */
  hrefTahsin?: string
  hrefTahfidz?: string
}

const WARNA_JENIS: Record<NonNullable<Peserta['capaian']>[number]['jenis'], string> = {
  ziyadah: 'bg-primary-wash text-primary',
  murojaah_baru: 'bg-accent-warm-wash text-accent-warm',
  murojaah_lama: 'bg-accent-warm-wash text-accent-warm',
  murojaah: 'bg-accent-warm-wash text-accent-warm',
  tasmi: 'bg-primary-wash text-primary',
  tahsin: 'bg-muted text-foreground',
}

const STATUS: { kode: StatusHadir; label: string; kelas: string }[] = [
  { kode: 'hadir', label: 'H', kelas: 'bg-primary text-primary-foreground' },
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
  // Anak yang belum dicatat tampil 'hadir' sebagai bawaan — dan dihitung
  // BELUM tersimpan, supaya kelas yang hadir semua tetap bisa disimpan
  // dengan satu ketukan. Sabtu yang belum tiba tidak diisi apa pun.
  const [isi, setIsi] = useState<Record<string, StatusHadir | null>>(
    () => Object.fromEntries(peserta.map(p => [p.id, hadir[p.id] ?? (terkunci ? null : 'hadir')])),
  )
  const berubah = peserta.filter(p => (isi[p.id] ?? null) !== (hadir[p.id] ?? null))
  const belumDicatat = peserta.filter(p => !hadir[p.id]).length
  const jumlahHadir = peserta.filter(p => isi[p.id] === 'hadir').length

  function simpan() {
    mulai(async () => {
      const hasil = await simpanHadirRiyadhohAction(tanggal, Object.fromEntries(berubah.map(p => [p.id, isi[p.id] ?? null])))
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
      {!terkunci && belumDicatat > 0 && (
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
                  <span className="text-muted-foreground">{p.kelas ? ` · ${p.kelas}` : ''}{p.halaqoh ? ` · ${p.halaqoh}` : ''}</span>
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {(p.capaian ?? []).map((c, i) => (
                    <span key={i} className={cn('inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', WARNA_JENIS[c.jenis])}>
                      <span className="truncate">{c.label} {c.teks}</span>
                      {c.ulang && <span className="font-normal opacity-80">(ulang)</span>}
                      {c.bintang && <span className="shrink-0 text-warning">{c.bintang}</span>}
                    </span>
                  ))}
                  {!p.capaian?.length && p.tahsin && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-primary-wash px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                      <BookOpen className="size-3" />Tahsin
                    </span>
                  )}
                  {!p.capaian?.length && p.tahfidz && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-primary-wash px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                      <Sparkles className="size-3" />Tahfidz
                    </span>
                  )}
                  {!p.tahsin && !p.tahfidz && !terkunci && !tidakDatang && (
                    <span className="rounded-md bg-accent-warm-wash px-1.5 py-0.5 text-[11px] font-semibold text-accent-warm">Belum setor</span>
                  )}
                </p>
                {!p.tahsin && !p.tahfidz && !terkunci && !tidakDatang && (p.hrefTahsin || p.hrefTahfidz) && (
                  <p className="mt-1.5 flex gap-1.5">
                    {p.hrefTahsin && (
                      <Link href={p.hrefTahsin}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                        <BookOpen className="size-3.5" />Setor tahsin
                      </Link>
                    )}
                    {p.hrefTahfidz && (
                      <Link href={p.hrefTahfidz}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border bg-card px-2.5 text-xs font-bold hover:bg-accent">
                        <Sparkles className="size-3.5" />Tahfidz
                      </Link>
                    )}
                  </p>
                )}
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
                    disabled={terkunci}
                    onClick={() => setIsi(v => ({ ...v, [p.id]: v[p.id] === s.kode ? null : s.kode }))}
                    className={cn(
                      'size-9 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40',
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

      {!terkunci && (
        <Button className="mt-2 h-11 w-full rounded-xl" onClick={simpan} disabled={pending || berubah.length === 0}>
          {pending ? 'Menyimpan…' : berubah.length ? `Simpan kehadiran (${berubah.length})` : 'Kehadiran tersimpan ✓'}
        </Button>
      )}
    </section>
  )
}
