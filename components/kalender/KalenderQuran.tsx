'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { batalKosongAction, simpanJadwalAction, tandaiKosongAction } from '@/app/actions/kalender-quran'
import {
  HARI_PILIHAN, HARI_SINGKAT, hariKe, hariProgram, hitungTM, tanggalSebulan,
  type HariKosong, type JadwalProgram,
} from '@/lib/rq/kalender-quran'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

export interface AgendaHari {
  tanggal: string
  judul: string
  libur: boolean
}

interface Props {
  termId: string
  jenjang: Jenjang
  tingkat: number
  tahun: number
  bulan: number
  /** Program yang ada di unit ini; '' = reguler/tanpa program. */
  programs: { code: string; label: string }[]
  jadwal: JadwalProgram[]
  kosong: HariKosong[]
  agenda: AgendaHari[]
  /** Rombel di angkatan ini, mis. ['2A','2B','2C']. */
  kelas: string[]
  bolehUbah: boolean
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Kalender aktif pembelajaran Al-Qur'an satu bulan, satu angkatan.
 *
 * Dua lapis yang diurus di sini: jadwal dasar per program (hari apa saja
 * sesi Qur'an berjalan) dan pengecualiannya (tanggal yang sesinya ditiadakan
 * karena agenda). Hasil keduanya adalah TM — penyebut kehadiran anak di
 * rapor, yang ditampilkan langsung di bawah supaya akibat tiap penandaan
 * kelihatan seketika, bukan baru terasa saat rapor dicetak.
 */
export function KalenderQuran({
  termId, jenjang, tingkat, tahun, bulan, programs, jadwal, kosong, agenda, kelas, bolehUbah,
}: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [dipilih, setDipilih] = useState<string | null>(null)
  const [sasaranKelas, setSasaranKelas] = useState<string>('')
  const [alasan, setAlasan] = useState('')

  const tanggal = useMemo(() => tanggalSebulan(tahun, bulan), [tahun, bulan])
  const agendaPer = useMemo(() => {
    const m = new Map<string, AgendaHari[]>()
    for (const a of agenda) m.set(a.tanggal, [...(m.get(a.tanggal) ?? []), a])
    return m
  }, [agenda])

  /** Program mana saja yang menjadwalkan sesi pada hari ini. */
  function programAktif(iso: string): { code: string; label: string }[] {
    return programs.filter(p => hariProgram(jadwal, { jenjang, program: p.code }).includes(hariKe(iso)))
  }

  function kosongHari(iso: string): HariKosong[] {
    return kosong.filter(k => k.tanggal === iso && k.jenjang === jenjang && k.tingkat === tingkat)
  }

  // TM per rombel — inilah angka yang dipakai rapor.
  const rekap = useMemo(() => {
    const dari = tanggal[0], sampai = tanggal[tanggal.length - 1]
    const rombel = kelas.length > 0 ? kelas : ['(semua)']
    return rombel.map(k => ({
      kelas: k,
      per: programs.map(p => ({
        label: p.label,
        tm: hitungTM(dari, sampai, jadwal, kosong, {
          jenjang, tingkat, kelas: kelas.length > 0 ? k : null, program: p.code,
        }),
      })),
    }))
  }, [tanggal, kelas, programs, jadwal, kosong, jenjang, tingkat])

  function ubahHari(program: string, hari: number) {
    const sekarang = hariProgram(jadwal, { jenjang, program })
    const baru = sekarang.includes(hari) ? sekarang.filter(h => h !== hari) : [...sekarang, hari].sort()
    mulai(async () => {
      const hasil = await simpanJadwalAction(termId, jenjang, program, baru)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  function tandai(iso: string) {
    mulai(async () => {
      const hasil = await tandaiKosongAction(iso, jenjang, tingkat, sasaranKelas || null, alasan)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(sasaranKelas ? `${iso} — ${sasaranKelas} ditandai kosong.` : `${iso} ditandai kosong.`)
      setAlasan('')
      router.refresh()
    })
  }

  function batal(id: string) {
    mulai(async () => {
      const hasil = await batalKosongAction(id, jenjang)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  // Kotak kosong pembuka supaya tanggal 1 jatuh di kolom harinya.
  const pembuka = (hariKe(tanggal[0]) + 6) % 7

  return (
    <div className="space-y-5">
      {/* ── Jadwal dasar ── */}
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">Hari aktif per program</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Berlaku satu semester. Anak QULS bersesi Jum&apos;at, jadi TM-nya lebih banyak — dan kehadirannya
            dibandingkan dengan TM programnya sendiri.
          </p>
        </div>
        <ul className="space-y-2">
          {programs.map(p => {
            const hari = hariProgram(jadwal, { jenjang, program: p.code })
            const diatur = jadwal.some(j => j.jenjang === jenjang && j.program === p.code)
            return (
              <li key={p.code || 'reguler'} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[10rem] flex-1 text-sm">
                  {p.label}
                  {!diatur && <span className="ml-1 text-[11px] text-muted-foreground">(bawaan)</span>}
                </span>
                <div className="flex gap-1">
                  {HARI_PILIHAN.map(h => (
                    <button
                      key={h}
                      type="button"
                      disabled={pending || !bolehUbah}
                      aria-pressed={hari.includes(h)}
                      onClick={() => ubahHari(p.code, h)}
                      className={cn(
                        'h-9 w-10 rounded-md border text-xs font-semibold transition-colors',
                        hari.includes(h) ? 'border-primary bg-primary-wash text-primary' : 'bg-card text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {HARI_SINGKAT[h]}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Kalender bulan ── */}
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{BULAN_ID[bulan - 1]} {tahun}</h2>

        <div className="grid grid-cols-7 gap-1 text-center">
          {[1, 2, 3, 4, 5, 6, 7].map(h => (
            <div key={h} className="pb-1 text-[11px] font-medium text-muted-foreground">{HARI_SINGKAT[h]}</div>
          ))}
          {Array.from({ length: pembuka }, (_, i) => <div key={`k${i}`} />)}
          {tanggal.map(iso => {
            const aktifUntuk = programAktif(iso)
            const kos = kosongHari(iso)
            const semuaKosong = kos.some(k => k.kelas === null)
            const adaAgenda = agendaPer.has(iso)
            const tak = aktifUntuk.length === 0
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setDipilih(iso === dipilih ? null : iso)}
                aria-pressed={iso === dipilih}
                className={cn(
                  'relative aspect-square rounded-md border text-sm transition-colors',
                  iso === dipilih && 'ring-2 ring-ring',
                  tak ? 'bg-muted/40 text-muted-foreground'
                    : semuaKosong ? 'border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/10'
                      : 'bg-card hover:bg-accent',
                )}
              >
                <span className={cn('font-medium', semuaKosong && 'line-through')}>{Number(iso.slice(8))}</span>
                {kos.length > 0 && !semuaKosong && (
                  <span className="absolute inset-x-0 bottom-0.5 text-[9px] text-[color:var(--destructive)]">
                    {kos.length} kls
                  </span>
                )}
                {adaAgenda && !tak && (
                  <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--chart-4)' }} />
                )}
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Abu-abu = bukan hari sesi. Titik jingga = ada agenda kaldik. Merah = sesi ditiadakan.
        </p>
      </section>

      {/* ── Hari terpilih ── */}
      {dipilih && (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">
              {new Date(`${dipilih}T00:00:00+07:00`).toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
              })}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {programAktif(dipilih).length === 0
                ? 'Bukan hari sesi Qur\'an untuk angkatan ini.'
                : `Sesi berjalan untuk: ${programAktif(dipilih).map(p => p.label).join(', ')}.`}
            </p>
          </div>

          {/* Agenda kaldik — usulan, bukan keputusan. */}
          {(agendaPer.get(dipilih) ?? []).map((a, i) => (
            <p key={i} className="rounded-md border border-dashed px-3 py-2 text-xs">
              <b>{a.libur ? 'Libur' : 'Agenda'}:</b> {a.judul}
              <span className="text-muted-foreground"> — dari kalender pendidikan, perlu Anda sahkan</span>
            </p>
          ))}

          {kosongHari(dipilih).map(k => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
              style={{ background: 'var(--destructive)', color: 'white' }}>
              <span>
                Ditiadakan untuk {k.kelas ?? `seluruh angkatan ${tingkat}`}
                {k.alasan && ` — ${k.alasan}`}
              </span>
              {bolehUbah && k.id && (
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => batal(k.id!)}
                  className="border-white/40 bg-transparent text-white hover:bg-white/15">
                  <RotateCcw /> Batalkan
                </Button>
              )}
            </div>
          ))}

          {bolehUbah && programAktif(dipilih).length > 0 && (
            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="sasaran">Yang ditiadakan</label>
                <select
                  id="sasaran" value={sasaranKelas} disabled={pending}
                  onChange={e => setSasaranKelas(e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Seluruh angkatan {tingkat}</option>
                  {kelas.map(k => <option key={k} value={k}>Kelas {k} saja</option>)}
                </select>
              </div>
              <div className="min-w-[12rem] flex-1 space-y-1">
                <label className="text-xs font-medium" htmlFor="alasan">Alasan</label>
                <Input id="alasan" value={alasan} disabled={pending} placeholder="Class meeting, outing, pekan ujian…"
                  onChange={e => setAlasan(e.target.value)} className="h-9" />
              </div>
              <Button type="button" disabled={pending} onClick={() => tandai(dipilih)}>
                <CalendarOff /> Tandai kosong
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ── Rekap TM ── */}
      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">Rekap tatap muka — {BULAN_ID[bulan - 1]} {tahun}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Inilah penyebut kehadiran anak di rapor: berapa kali sesi Qur&apos;an dijadwalkan dan tidak ditiadakan.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b px-2 py-1.5">Kelas</th>
                {programs.map(p => <th key={p.code || 'r'} className="border-b px-2 py-1.5 text-center">{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rekap.map(r => (
                <tr key={r.kelas}>
                  <td className="border-b px-2 py-1.5 font-medium">{r.kelas}</td>
                  {r.per.map((x, i) => (
                    <td key={i} className="border-b px-2 py-1.5 text-center tabular-nums">{x.tm}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
