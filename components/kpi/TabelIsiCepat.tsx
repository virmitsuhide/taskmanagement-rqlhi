'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { hitungKpi } from '@/lib/kpi/hitung'
import { simpanIsiCepatKpiAction, type BarisIsiCepat, type KolomIsiCepat } from '@/app/actions/kpi'
import type { Jenjang, KpiMonthly } from '@/types'

/** Kolom tabel, urut sama dengan 11 indikator KPI. `kolom` null = baca saja. */
const KOLOM: { idx: number; label: string; pendek: string; kolom: KolomIsiCepat | null }[] = [
  { idx: 0, label: 'Kedisiplinan Hadir', pendek: 'Hadir', kolom: 'nilai_hadir' },
  { idx: 1, label: 'Pengisian Database', pendek: 'Database', kolom: 'nilai_database' },
  { idx: 2, label: "Hafalan Al-Qur'an (dari Setoran Guru)", pendek: 'Hafalan', kolom: null },
  { idx: 3, label: 'Tuhfatul Athfal (dari Setoran Guru)', pendek: 'Tuhfatul', kolom: null },
  { idx: 4, label: "Bacaan Al-Qur'an", pendek: 'Bacaan', kolom: 'bacaan_score' },
  { idx: 5, label: 'Seragam', pendek: 'Seragam', kolom: 'seragam_total' },
  { idx: 6, label: 'Laporan Grup Orang Tua', pendek: 'Lapor ortu', kolom: 'lapor_ortu_total' },
  { idx: 7, label: 'Hadir & Mengakhiri Halaqoh', pendek: 'Halaqoh', kolom: 'halaqoh_total' },
  { idx: 8, label: 'Buku Pegangan Guru', pendek: 'Buku peg.', kolom: 'nilai_buku_pegangan' },
  { idx: 9, label: 'Buku Perizinan', pendek: 'Perizinan', kolom: 'nilai_perizinan' },
  { idx: 10, label: 'Mencari Pengganti', pendek: 'Pengganti', kolom: 'nilai_pengganti' },
]
const DAPAT_DIISI = KOLOM.filter(k => k.kolom !== null)

export interface BarisTabelKpi {
  teacherId: string
  nama: string
  unit: Jenjang | null
  terkunci: boolean
  /** Baris KPI tersimpan, atau null bila belum pernah diisi. */
  entry: KpiMonthly | null
  /** Posisi hafalan dari Setoran Guru bulan ini (menang atas entry). */
  setoran: { hafalan_juz?: number; hafalan_pages?: number; tuhfatul_bait?: number }
}

type Isian = Record<KolomIsiCepat, string>

const teks = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100))
const angka = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null
}

function isianAwal(b: BarisTabelKpi): Isian {
  const e = b.entry
  return {
    nilai_hadir: teks(e?.nilai_hadir),
    nilai_database: teks(e?.nilai_database),
    bacaan_score: e ? teks(e.bacaan_score) : '',
    seragam_total: teks(e?.seragam_total),
    lapor_ortu_total: teks(e?.lapor_ortu_total),
    halaqoh_total: teks(e?.halaqoh_total),
    nilai_buku_pegangan: teks(e?.nilai_buku_pegangan),
    nilai_perizinan: teks(e?.nilai_perizinan),
    nilai_pengganti: teks(e?.nilai_pengganti),
  }
}

/**
 * Nilai tiap indikator dengan isian tabel diterapkan di atas baris tersimpan.
 * `rinci` = nilai tanpa isian langsung — dipakai sebagai placeholder sel,
 * supaya SDM tahu angka apa yang berlaku bila selnya dikosongkan.
 */
function hitung(b: BarisTabelKpi, isi: Isian | null) {
  const e = b.entry
  const n = (v: number | undefined | null) => Number(v ?? 0)
  const pakai = (k: KolomIsiCepat) => (isi ? angka(isi[k]) : null)
  return hitungKpi(
    {
      lateMinutes: n(e?.late_minutes), dbLateDays: n(e?.db_late_days),
      hafalanJuz: b.setoran.hafalan_juz ?? n(e?.hafalan_juz),
      hafalanPages: b.setoran.hafalan_pages ?? n(e?.hafalan_pages),
      tuhfatulBait: b.setoran.tuhfatul_bait ?? n(e?.tuhfatul_bait),
      bacaanScore: pakai('bacaan_score') ?? n(e?.bacaan_score),
      bukuPeganganMeetings: n(e?.buku_pegangan_meetings), izinWaCases: n(e?.izin_wa_cases),
      penggantiCases: n(e?.pengganti_cases), penggantiFound: n(e?.pengganti_found),
      langsung: isi ? {
        hadir: pakai('nilai_hadir'), database: pakai('nilai_database'), bukuPegangan: pakai('nilai_buku_pegangan'),
        perizinan: pakai('nilai_perizinan'), pengganti: pakai('nilai_pengganti'),
      } : undefined,
    },
    {
      seragamDaily: e?.seragam_daily ?? null, laporOrtuDaily: e?.lapor_ortu_daily ?? null,
      halaqohHadir: e?.halaqoh_hadir ?? null, halaqohAkhiri: e?.halaqoh_akhiri ?? null,
      seragamTotal: isi ? pakai('seragam_total') : null,
      laporOrtuTotal: isi ? pakai('lapor_ortu_total') : null,
      halaqohTotal: isi ? pakai('halaqoh_total') : null,
    },
    e?.unit ?? b.unit,
  )
}

/**
 * Isi cepat KPI — satu tabel per unit: baris = guru, kolom = indikator.
 * Sel berisi NILAI AKHIR 0–100; sel kosong = nilai dihitung dari rincian
 * (angka abu-abu di dalamnya). Enter/↓/↑ berpindah baris di kolom yang sama,
 * karena mengisi biasanya dilakukan per indikator dari satu rekap.
 */
export function TabelIsiCepat({ baris, year, month, bolehIsi, unitParam }: {
  baris: BarisTabelKpi[]
  year: number
  month: number
  bolehIsi: boolean
  unitParam: string
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const awal = useMemo(() => Object.fromEntries(baris.map(b => [b.teacherId, isianAwal(b)])), [baris])
  const [isian, setIsian] = useState<Record<string, Isian>>(awal)

  const berubah = baris.filter(b => DAPAT_DIISI.some(k => isian[b.teacherId][k.kolom!] !== awal[b.teacherId][k.kolom!]))

  function ubah(id: string, k: KolomIsiCepat, v: string) {
    setIsian(p => ({ ...p, [id]: { ...p[id], [k]: v } }))
  }

  function pindah(e: React.KeyboardEvent<HTMLInputElement>, baris: number, kolom: number) {
    const arah = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!arah) return
    e.preventDefault()
    const target = document.querySelector<HTMLInputElement>(`[data-sel="${baris + arah}-${kolom}"]`)
    target?.focus(); target?.select()
  }

  function simpan() {
    const kirim: BarisIsiCepat[] = berubah.map(b => ({
      teacher_id: b.teacherId,
      nilai: Object.fromEntries(DAPAT_DIISI.map(k => [k.kolom!, angka(isian[b.teacherId][k.kolom!])])),
    }))
    mulai(async () => {
      const r = await simpanIsiCepatKpiAction(year, month, kirim)
      if (r.error) { toast.error(r.error); return }
      toast.success(`${r.disimpan ?? 0} guru tersimpan.${r.terkunci ? ` ${r.terkunci} rapor terkunci dilewati.` : ''}`)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">Guru</th>
              {KOLOM.map(k => (
                <th key={k.idx} title={k.label} className={cn('px-1 py-2 text-center font-semibold', !k.kolom && 'bg-muted/60')}>
                  <span className="block text-[10px] font-normal">{k.idx + 1}</span>{k.pendek}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold">Rapor</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => {
              const isi = isian[b.teacherId]
              const rinci = hitung(b, null).nilai
              const kini = hitung(b, isi)
              const dikunci = b.terkunci || !bolehIsi
              return (
                <tr key={b.teacherId} className={cn('border-b last:border-0', berubah.includes(b) && 'bg-primary-wash/40')}>
                  <td className="sticky left-0 z-10 max-w-[12rem] bg-card px-3 py-1.5">
                    <Link href={`/kpi/isi?teacher=${b.teacherId}&unit=${unitParam}&year=${year}&month=${month}`} className="block truncate font-medium hover:text-primary hover:underline" title="Buka formulir rinci">{b.nama}</Link>
                    <span className="text-[10px] text-muted-foreground">
                      {b.terkunci ? <span className="inline-flex items-center gap-0.5 text-warning"><Lock className="h-2.5 w-2.5" />terkunci</span> : b.entry ? 'tersimpan' : 'belum diisi'}
                    </span>
                  </td>
                  {KOLOM.map((k, j) => k.kolom ? (
                    <td key={k.idx} className="px-0.5 py-1">
                      <input
                        data-sel={`${i}-${j}`}
                        type="text" inputMode="decimal" aria-label={`${k.label} — ${b.nama}`}
                        value={isi[k.kolom]}
                        placeholder={k.kolom === 'bacaan_score' ? '0' : String(Math.round(rinci[k.idx]))}
                        disabled={dikunci}
                        onChange={e => ubah(b.teacherId, k.kolom!, e.target.value)}
                        onKeyDown={e => pindah(e, i, j)}
                        onFocus={e => e.target.select()}
                        className={cn('h-8 w-full min-w-[3.25rem] rounded-md border bg-background px-1 text-center tabular-nums outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:bg-muted/50',
                          isi[k.kolom] !== awal[b.teacherId][k.kolom] && 'border-primary')}
                      />
                    </td>
                  ) : (
                    <td key={k.idx} className="bg-muted/30 px-1 py-1 text-center tabular-nums text-muted-foreground" title="Dari Setoran Guru — ubah lewat menu Setoran Guru">
                      {Math.round(kini.nilai[k.idx] * 10) / 10}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center">
                    <span className="block font-semibold tabular-nums">{kini.rapot.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
                    <span className="block text-[10px] text-muted-foreground">Level {kini.level}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {bolehIsi && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">
            Sel kosong = dihitung dari rincian (angka abu-abu). Enter / ↓ pindah ke guru berikutnya.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={pending || berubah.length === 0} onClick={() => setIsian(awal)}>Batalkan</Button>
            <Button disabled={pending || berubah.length === 0} onClick={simpan}>
              {pending ? 'Menyimpan…' : `Simpan ${berubah.length || ''} guru`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
