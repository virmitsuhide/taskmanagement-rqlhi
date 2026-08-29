'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { simpanKpiAction } from '@/app/actions/kpi'
import { paramFor, type KpiParam } from '@/lib/kpi/parameter'
import { hitungKpi, KPI_INDIKATOR } from '@/lib/kpi/hitung'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Jenjang, KpiMonthly } from '@/types'

interface Props {
  teacherId: string
  teacherName: string
  year: number
  month: number
  monthLabel: string
  backHref: string
  existing: KpiMonthly | null
  /** Menentukan rubrik: SMP menargetkan 5 juz, SD 3 juz. */
  unit: Jenjang | null
}

/**
 * Sepuluh isian bulanan — sepadan kolom E–N tab "Input" pada spreadsheet.
 *
 * Dibuat sebagai fungsi, bukan tetapan modul, karena keterangan dan batasnya
 * bergantung rubrik unit: petunjuk hafalan SMP menyebut 12 poin per juz,
 * SD menyebut 20.
 */
const bulananFields = (P: KpiParam): { name: keyof KpiMonthly & string; label: string; hint: string; max?: number }[] => [
  { name: 'late_minutes', label: 'Rata-rata keterlambatan hadir (menit)', hint: '≤20 mnt = 100 · ≤50 = 80 · ≤75 = 60 · ≤100 = 40 · >100 = 20' },
  { name: 'db_late_days', label: 'Keterlambatan setor database (hari)', hint: '0 hari = 100 · 1 = 90 · 2 = 80 · 3 = 70 · >3 = 60' },
  { name: 'hafalan_juz', label: "Hafalan Al-Qur'an — juz utuh", hint: `Basis ${P.basisHafalan} + ${P.poinPerJuz} poin per juz` },
  { name: 'hafalan_pages', label: "Hafalan Al-Qur'an — sisa halaman", hint: `${P.poinPerHalaman} poin per halaman`, max: P.halamanPerJuz },
  { name: 'tuhfatul_bait', label: 'Hafalan Tuhfatul Athfal — jumlah bait', hint: `Bait ke-1 = ${P.poinBaitPertama} poin, sisanya ${P.poinBaitBerikutnya} poin`, max: P.totalBait },
  { name: 'bacaan_score', label: "Bacaan Al-Qur'an sesuai metode", hint: 'Langsung berupa nilai 0–100', max: 100 },
  { name: 'buku_pegangan_meetings', label: 'Buku pegangan guru — pertemuan terisi', hint: `Basis ${P.basisBukuPegangan} + ${P.poinPerPertemuanBuku} poin per pertemuan`, max: P.pertemuanBukuPegangan },
  { name: 'izin_wa_cases', label: 'Izin lewat WA tanpa menulis buku (kasus)', hint: `Tiap kasus mengurangi ${P.penguranganIzin} poin dari 100` },
  { name: 'pengganti_cases', label: 'Cari pengganti — jumlah kasus izin', hint: 'Tidak pernah izin = otomatis 100' },
  { name: 'pengganti_found', label: 'Cari pengganti — berhasil dapat', hint: 'Dinilai dari rasio berhasil ÷ kasus' },
]

const angka = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Form KPI satu guru untuk satu bulan.
 *
 * Nilainya dihitung ULANG di peramban selagi diketik, memakai fungsi yang sama
 * persis dengan yang dipakai server (lib/kpi/hitung.ts). Bukan duplikat rumus:
 * satu modul dipanggil dari dua tempat, jadi angka pratinjau tidak mungkin
 * berbeda dari angka yang tersimpan.
 */
export function KpiForm({ teacherId, teacherName, year, month, monthLabel, backHref, existing, unit }: Props) {
  const P = paramFor(unit)
  const router = useRouter()
  const [state, action, isPending] = useActionState(simpanKpiAction, null)

  const [bulanan, setBulanan] = useState<Record<string, string>>(() =>
    Object.fromEntries(bulananFields(paramFor(unit)).map(f => [f.name, String(existing?.[f.name] ?? 0)])),
  )

  // Mode rinci vs total. Kalau baris tersimpan punya *_total terisi, berarti
  // dulu diisi lewat jalan pintas — bukalah kembali dalam mode yang sama supaya
  // yang mengedit tidak bingung melihat grid kosong padahal nilainya ada.
  const [mode, setMode] = useState<'grid' | 'total'>(
    existing && (existing.seragam_total !== null || existing.lapor_ortu_total !== null || existing.halaqoh_total !== null)
      ? 'total'
      : 'grid',
  )

  const [seragam, setSeragam] = useState<number[]>(
    () => existing?.seragam_daily ?? Array(P.hariPenilaian).fill(0),
  )
  const [laporOrtu, setLaporOrtu] = useState<number[]>(
    () => existing?.lapor_ortu_daily ?? Array(P.hariPenilaian).fill(0),
  )
  const [hadir, setHadir] = useState<number[]>(
    () => existing?.halaqoh_hadir ?? Array(P.pertemuanHalaqoh).fill(0),
  )
  const [akhiri, setAkhiri] = useState<number[]>(
    () => existing?.halaqoh_akhiri ?? Array(P.pertemuanHalaqoh).fill(0),
  )

  const [totals, setTotals] = useState({
    seragam_total: String(existing?.seragam_total ?? ''),
    lapor_ortu_total: String(existing?.lapor_ortu_total ?? ''),
    halaqoh_total: String(existing?.halaqoh_total ?? ''),
  })

  const hasil = hitungKpi(
    {
      lateMinutes: angka(bulanan.late_minutes),
      dbLateDays: angka(bulanan.db_late_days),
      hafalanJuz: angka(bulanan.hafalan_juz),
      hafalanPages: angka(bulanan.hafalan_pages),
      tuhfatulBait: angka(bulanan.tuhfatul_bait),
      bacaanScore: angka(bulanan.bacaan_score),
      bukuPeganganMeetings: angka(bulanan.buku_pegangan_meetings),
      izinWaCases: angka(bulanan.izin_wa_cases),
      penggantiCases: angka(bulanan.pengganti_cases),
      penggantiFound: angka(bulanan.pengganti_found),
    },
    mode === 'grid'
      ? {
          seragamDaily: seragam, laporOrtuDaily: laporOrtu,
          halaqohHadir: hadir, halaqohAkhiri: akhiri,
          seragamTotal: null, laporOrtuTotal: null, halaqohTotal: null,
        }
      : {
          seragamDaily: null, laporOrtuDaily: null, halaqohHadir: null, halaqohAkhiri: null,
          seragamTotal: angka(totals.seragam_total),
          laporOrtuTotal: angka(totals.lapor_ortu_total),
          halaqohTotal: angka(totals.halaqoh_total),
        },
    unit,
  )

  // Berpindah halaman adalah efek samping, jadi tempatnya di useEffect — bukan
  // di badan render. Memanggil router.push() saat render membuat React
  // memperbarui komponen lain di tengah render komponen ini.
  useEffect(() => {
    if (!state?.success) return
    toast.success('Nilai KPI tersimpan')
    router.push(backHref)
  }, [state, router, backHref])

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="teacher_id" value={teacherId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />

      {/* Ringkasan nilai — ikut berubah selagi diketik */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>{teacherName}</CardTitle>
          <CardDescription>Periode {monthLabel} {year} · nilai di bawah dihitung langsung saat kamu mengetik.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {hasil.nilai.map((n, i) => (
              <div key={i} className="rounded-lg border bg-background px-2.5 py-2">
                <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2 h-6">{KPI_INDIKATOR[i]}</p>
                <p className="text-lg font-bold tabular-nums mt-0.5">{Math.round(n * 10) / 10}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Total <b className="text-foreground tabular-nums">{Math.round(hasil.total * 10) / 10}</b></span>
            <span className="text-xs text-muted-foreground">Nilai Rapot KPI <b className="text-foreground tabular-nums text-base">{hasil.rapot.toFixed(2)}</b></span>
            <span className="text-xs text-muted-foreground">Level <b className="text-foreground">{hasil.level} — {hasil.predikat}</b></span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{hasil.tindakLanjut}</p>
        </CardContent>
      </Card>

      {/* Isian bulanan */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Isian Bulanan</CardTitle>
          <CardDescription>Sepuluh angka yang menentukan tujuh dari sebelas indikator.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
          {bulananFields(P).map(f => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
                name={f.name}
                type="number"
                min={0}
                max={f.max}
                step="any"
                inputMode="decimal"
                value={bulanan[f.name]}
                onChange={e => setBulanan(b => ({ ...b, [f.name]: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Seragam · Lapor Ortu · Halaqoh */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Seragam, Laporan Ortu & Halaqoh</CardTitle>
              <CardDescription>
                {mode === 'grid'
                  ? 'Isi per hari / per pertemuan seperti di spreadsheet.'
                  : 'Isi langsung nilai akhir 0–100 tiap indikator.'}
              </CardDescription>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(['grid', 'total'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'grid' ? 'Rinci harian' : 'Isi total'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          {mode === 'grid' ? (
            <>
              <GridHarian
                judul={`Pemakaian seragam — ${P.hariPenilaian} hari, maksimal ${P.poinSeragamPerHari} poin per hari`}
                prefix="seragam" nilai={seragam} setNilai={setSeragam} max={P.poinSeragamPerHari} labelAwal="Hari"
              />
              <GridHarian
                judul={`Laporan grup orang tua — ${P.hariPenilaian} hari, maksimal ${P.poinLaporOrtuPerHari} poin per hari (+${P.basisLaporOrtu} bonus)`}
                prefix="lapor_ortu" nilai={laporOrtu} setNilai={setLaporOrtu} max={P.poinLaporOrtuPerHari} labelAwal="Hari"
              />
              <GridHarian
                judul={`Halaqoh — kehadiran, ${P.pertemuanHalaqoh} pertemuan, maksimal ${P.poinHadirHalaqoh}`}
                prefix="halaqoh_hadir" nilai={hadir} setNilai={setHadir} max={P.poinHadirHalaqoh} labelAwal="Pert."
              />
              <GridHarian
                judul={`Halaqoh — mengakhiri tepat waktu, ${P.pertemuanHalaqoh} pertemuan, maksimal ${P.poinAkhiriHalaqoh} (+${P.basisHalaqoh} bonus)`}
                prefix="halaqoh_akhiri" nilai={akhiri} setNilai={setAkhiri} max={P.poinAkhiriHalaqoh} labelAwal="Pert."
              />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ['seragam_total', 'Pemakaian Seragam'],
                ['lapor_ortu_total', 'Laporan Grup Orang Tua'],
                ['halaqoh_total', 'Kedisiplinan Halaqoh'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key} name={key} type="number" min={0} max={100} step="any" inputMode="decimal"
                    value={totals[key]}
                    onChange={e => setTotals(t => ({ ...t, [key]: e.target.value }))}
                    placeholder="0–100"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Rincian per hari tidak tersimpan dalam mode ini, jadi nanti tidak bisa ditelusuri
                hari mana yang bermasalah kalau gurunya bertanya.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/*
        Dua kotak ini yang tercetak di rapor bulanan guru. Dibiarkan kosong pun
        rapornya tetap terisi — lembar cetak jatuh ke kalimat turunan dari nilai
        indikator (lib/kpi/rapor-bulanan.ts). Yang diketik di sini menggantikan
        kalimat turunan itu, per bagian.
      */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Catatan untuk Rapor Guru</CardTitle>
          <CardDescription>
            Tercetak di rapor KPI bulanan yang diserahkan kepada guru. Satu butir per
            baris. Dikosongkan = rapor memakai kalimat yang disusun otomatis dari
            nilainya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="apresiasi">Apresiasi &amp; Catatan Positif</Label>
            <Textarea
              id="apresiasi"
              name="apresiasi"
              rows={4}
              defaultValue={(existing?.apresiasi ?? []).join('\n')}
              placeholder={'Sangat disiplin hadir dan konsisten tepat waktu.'+'\n'+'Seragam rapi dan sesuai ketentuan setiap hari.'+'\n'+'Komunikasi dengan orang tua sangat baik.'}
            />
            <p className="text-[11px] text-muted-foreground">Satu apresiasi per baris.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pengembangan">Area Pengembangan (Action Plan)</Label>
            <Textarea
              id="pengembangan"
              name="pengembangan"
              rows={4}
              defaultValue={(existing?.pengembangan ?? []).join('\n')}
              placeholder={'Pengisian buku pegangan guru perlu selesai tepat waktu setiap hari.'+'\n'+'Tingkatkan variasi metode agar seluruh murid terlibat aktif.'}
            />
            <p className="text-[11px] text-muted-foreground">
              Satu rencana perbaikan per baris — sebutkan yang bisa dikerjakan, bukan sifatnya.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Catatan Internal</CardTitle>
          <CardDescription>Untuk pengurus saja — tidak ikut tercetak di rapor guru.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <Textarea name="notes" defaultValue={existing?.notes ?? ''} placeholder="Catatan pembinaan, konteks, atau kesepakatan dengan guru..." />
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{state.error}</p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Menyimpan...' : 'Simpan Nilai KPI'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * Satu baris petak angka kecil.
 *
 * Tiap petak adalah input tersendiri bernama `<prefix>_<i>`, jadi seluruh grid
 * ikut terkirim lewat FormData tanpa perlu hidden input tambahan. Saat mode
 * "Isi total" aktif, grid ini tidak dirender sama sekali — itulah yang membuat
 * server tahu bahwa rincian hariannya memang sengaja dilewati, bukan nol.
 */
function GridHarian({
  judul, prefix, nilai, setNilai, max, labelAwal,
}: {
  judul: string
  prefix: string
  nilai: number[]
  setNilai: (v: number[]) => void
  max: number
  labelAwal: string
}) {
  const total = nilai.reduce((t, n) => t + n, 0)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium">{judul}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNilai(nilai.map(() => max))}
            className="text-[11px] text-primary hover:underline"
          >
            Isi penuh
          </button>
          <button
            type="button"
            onClick={() => setNilai(nilai.map(() => 0))}
            className="text-[11px] text-muted-foreground hover:underline"
          >
            Kosongkan
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Jumlah <b className="text-foreground">{total}</b>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nilai.map((v, i) => (
          <label key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-muted-foreground">{labelAwal} {i + 1}</span>
            <input
              type="number"
              name={`${prefix}_${i}`}
              min={0}
              max={max}
              value={v}
              onChange={e => {
                const n = Math.max(0, Math.min(max, Number(e.target.value) || 0))
                setNilai(nilai.map((old, j) => (j === i ? n : old)))
              }}
              className="h-8 w-11 rounded-md border bg-background text-center text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
