'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { simpanKpiAction } from '@/app/actions/kpi'
import { paramFor, type KpiParam } from '@/lib/kpi/parameter'
import { hitungKpi, KPI_INDIKATOR } from '@/lib/kpi/hitung'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Check, ChevronRight } from 'lucide-react'
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
  /**
   * Posisi hafalan dari setoran terakhir bulan ini (Setoran Guru, 0096).
   * Bidang yang terisi dikunci di formulir: sumber kebenarannya setoran.
   */
  dariSetoran?: { nilai: Partial<Record<'hafalan_juz' | 'hafalan_pages' | 'tuhfatul_bait', number>>; keterangan: Partial<Record<'hafalan_juz' | 'hafalan_pages' | 'tuhfatul_bait', string>> }
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
  { name: 'late_minutes', label: 'Total keterlambatan hadir sebulan (menit)', hint: '≤20 mnt = 100 · ≤50 = 80 · ≤75 = 60 · ≤100 = 40 · >100 = 20' },
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

/** Isian rinci → kunci nilai langsungnya (0097). */
const LANGSUNG_DARI_FIELD: Partial<Record<string, KunciLangsung>> = {
  late_minutes: 'hadir',
  db_late_days: 'database',
  buku_pegangan_meetings: 'bukuPegangan',
  izin_wa_cases: 'perizinan',
  pengganti_cases: 'pengganti',
  pengganti_found: 'pengganti',
}
type KunciLangsung = 'hadir' | 'database' | 'bukuPegangan' | 'perizinan' | 'pengganti'
const KOLOM_LANGSUNG: Record<KunciLangsung, string> = {
  hadir: 'nilai_hadir', database: 'nilai_database', bukuPegangan: 'nilai_buku_pegangan',
  perizinan: 'nilai_perizinan', pengganti: 'nilai_pengganti',
}

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
export function KpiForm({ teacherId, teacherName, year, month, monthLabel, backHref, existing, unit, dariSetoran }: Props) {
  const P = paramFor(unit)
  const router = useRouter()
  const [state, action, isPending] = useActionState(simpanKpiAction, null)

  const [bulanan, setBulanan] = useState<Record<string, string>>(() =>
    Object.fromEntries(bulananFields(paramFor(unit)).map(f => [
      f.name,
      String(dariSetoran?.nilai[f.name as keyof typeof dariSetoran.nilai] ?? existing?.[f.name] ?? 0),
    ])),
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
    () => sepanjang(existing?.seragam_daily, P.hariPenilaian),
  )
  const [laporOrtu, setLaporOrtu] = useState<number[]>(
    () => sepanjang(existing?.lapor_ortu_daily, P.hariLaporOrtu),
  )
  const [hadir, setHadir] = useState<number[]>(
    () => sepanjang(existing?.halaqoh_hadir, P.pertemuanHalaqoh),
  )
  const [akhiri, setAkhiri] = useState<number[]>(
    () => sepanjang(existing?.halaqoh_akhiri, P.pertemuanHalaqoh),
  )

  const [totals, setTotals] = useState({
    seragam_total: String(existing?.seragam_total ?? ''),
    lapor_ortu_total: String(existing?.lapor_ortu_total ?? ''),
    halaqoh_total: String(existing?.halaqoh_total ?? ''),
  })

  // Nilai langsung dari tabel isi cepat. Dibiarkan apa adanya saat formulir ini
  // disimpan, kecuali SDM memilih kembali memakai rincian (hapus_langsung).
  const [langsung, setLangsung] = useState<Partial<Record<KunciLangsung, number | null>>>(() => ({
    hadir: existing?.nilai_hadir ?? null,
    database: existing?.nilai_database ?? null,
    bukuPegangan: existing?.nilai_buku_pegangan ?? null,
    perizinan: existing?.nilai_perizinan ?? null,
    pengganti: existing?.nilai_pengganti ?? null,
  }))
  const dilepas = (Object.keys(KOLOM_LANGSUNG) as KunciLangsung[])
    .filter(k => langsung[k] === null && existing?.[KOLOM_LANGSUNG[k] as keyof KpiMonthly] != null)

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
      langsung,
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

  const semuaField = bulananFields(P)
  const terkunci = (name: string) =>
    dariSetoran?.nilai[name as keyof typeof dariSetoran.nilai] !== undefined
  const fieldSistem = semuaField.filter(f => terkunci(f.name))
  const fieldIsian = semuaField.filter(f => !terkunci(f.name))
  const terisi = fieldIsian.filter(f => angka(bulanan[f.name]) !== 0).length
  const langsungAktif = (Object.keys(KOLOM_LANGSUNG) as KunciLangsung[]).filter(k => langsung[k] != null)

  const renderField = (f: ReturnType<typeof bulananFields>[number]) => (
    <div key={f.name} className="space-y-1.5">
      <Label htmlFor={f.name} className="text-[13px] font-bold leading-snug">{f.label}</Label>
      <Input
        id={f.name}
        name={f.name}
        type="number"
        min={0}
        max={f.max}
        step="any"
        inputMode="decimal"
        value={bulanan[f.name]}
        readOnly={terkunci(f.name)}
        className={cn('h-11 rounded-xl text-base font-bold tabular-nums', terkunci(f.name) && 'bg-muted')}
        onChange={e => setBulanan(b => ({ ...b, [f.name]: e.target.value }))}
      />
      <p className="text-xs text-muted-foreground">{f.hint}</p>
      {(() => {
        const k = LANGSUNG_DARI_FIELD[f.name]
        const v = k ? langsung[k] : null
        if (!k || v === null || v === undefined) return null
        return (
          <p className="text-xs font-medium text-warning">
            Nilai langsung {v} dipakai (diisi di tabel isi cepat); angka ini diabaikan.{' '}
            <button type="button" className="font-semibold text-primary underline" onClick={() => setLangsung(l => ({ ...l, [k]: null }))}>
              Pakai rincian
            </button>
          </p>
        )
      })()}
      {dariSetoran?.keterangan[f.name as keyof typeof dariSetoran.keterangan] && (
        <p className="text-xs font-medium text-primary">{dariSetoran.keterangan[f.name as keyof typeof dariSetoran.keterangan]}</p>
      )}
    </div>
  )

  return (
    <form action={action} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <input type="hidden" name="teacher_id" value={teacherId} />
      {dilepas.map(k => <input key={k} type="hidden" name="hapus_langsung" value={KOLOM_LANGSUNG[k]} />)}
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />

      <div className="min-w-0 space-y-4">
        {/* 1 · Dari sistem */}
        <Step
          no={1}
          done
          title="Dari sistem"
          sub={fieldSistem.length > 0 || langsungAktif.length > 0
            ? 'Terisi otomatis dari setoran & tabel isi cepat — tidak perlu diubah'
            : 'Belum ada angka otomatis untuk bulan ini'}
        >
          {fieldSistem.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fieldSistem.map(renderField)}</div>
          )}
          {langsungAktif.length > 0 && (
            <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', fieldSistem.length > 0 && 'mt-4')}>
              {langsungAktif.map(k => (
                <div key={k} className="rounded-xl bg-muted/60 px-3.5 py-3">
                  <p className="text-xs text-muted-foreground">Nilai langsung · {LABEL_LANGSUNG[k]}</p>
                  <p className="mt-1 font-heading text-2xl tabular-nums">{langsung[k]}</p>
                </div>
              ))}
            </div>
          )}
          {fieldSistem.length === 0 && langsungAktif.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Hafalan terisi otomatis bila guru sudah menyetor bulan ini; nilai langsung muncul bila
              diisi lewat tabel isi cepat. Untuk sekarang semua angka diisi di langkah 2.
            </p>
          )}
        </Step>

        {/* 2 · Isian bulanan */}
        <Step no={2} title="Isian bulanan" sub={`${fieldIsian.length} isian · ${terisi} sudah terisi`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fieldIsian.map(renderField)}</div>
        </Step>

        {/* 3 · Seragam · Lapor Ortu · Halaqoh */}
        <Step no={3} title="Seragam, laporan ortu, halaqoh" sub="Pilih cara isi: total saja atau rinci per hari / pertemuan">
          <div className="mb-4 flex w-fit gap-1 rounded-xl bg-muted p-1">
            {(['total', 'grid'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors',
                  mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'grid' ? 'Rinci harian' : 'Total saja'}
              </button>
            ))}
          </div>
          {mode === 'grid' ? (
            <div className="space-y-5">
              <GridHarian
                judul={`Pemakaian seragam — ${P.hariPenilaian} hari, maksimal ${P.poinSeragamPerHari} poin per hari`}
                prefix="seragam" nilai={seragam} setNilai={setSeragam} max={P.poinSeragamPerHari} labelAwal="Hari"
              />
              <GridHarian
                judul={`Laporan grup orang tua — ${P.hariLaporOrtu} hari aktif, maksimal ${P.poinLaporOrtuPerHari} poin per hari (+${P.basisLaporOrtu} bonus)`}
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
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ['seragam_total', 'Pemakaian seragam'],
                ['lapor_ortu_total', 'Laporan grup orang tua'],
                ['halaqoh_total', 'Kedisiplinan halaqoh'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key} className="text-[13px] font-bold">{label}</Label>
                  <Input
                    id={key} name={key} type="number" min={0} max={100} step="any" inputMode="decimal"
                    value={totals[key]}
                    onChange={e => setTotals(t => ({ ...t, [key]: e.target.value }))}
                    placeholder="0–100"
                    className="h-11 rounded-xl text-base font-bold tabular-nums"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Isi langsung nilai akhir 0–100. Rincian per hari tidak tersimpan dalam mode ini, jadi
                nanti tidak bisa ditelusuri hari mana yang bermasalah kalau gurunya bertanya.
              </p>
            </div>
          )}
        </Step>

        {/*
          Dua kotak ini yang tercetak di rapor bulanan guru. Dibiarkan kosong pun
          rapornya tetap terisi — lembar cetak jatuh ke kalimat turunan dari nilai
          indikator (lib/kpi/rapor-bulanan.ts). Yang diketik di sini menggantikan
          kalimat turunan itu, per bagian.
        */}
        <Step
          no={4}
          title="Catatan untuk rapor guru"
          sub="Tercetak di rapor setelah terbit. Satu butir per baris; dikosongkan = kalimat otomatis dari nilainya."
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="apresiasi" className="text-[13px] font-bold">Apresiasi &amp; catatan positif</Label>
              <Textarea
                id="apresiasi"
                name="apresiasi"
                rows={4}
                className="rounded-xl"
                defaultValue={(existing?.apresiasi ?? []).join('\n')}
                placeholder={'Sangat disiplin hadir dan konsisten tepat waktu.'+'\n'+'Seragam rapi dan sesuai ketentuan setiap hari.'+'\n'+'Komunikasi dengan orang tua sangat baik.'}
              />
              <p className="text-[11px] text-muted-foreground">Satu apresiasi per baris.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pengembangan" className="text-[13px] font-bold">Area pengembangan (action plan)</Label>
              <Textarea
                id="pengembangan"
                name="pengembangan"
                rows={4}
                className="rounded-xl"
                defaultValue={(existing?.pengembangan ?? []).join('\n')}
                placeholder={'Pengisian buku pegangan guru perlu selesai tepat waktu setiap hari.'+'\n'+'Tingkatkan variasi metode agar seluruh murid terlibat aktif.'}
              />
              <p className="text-[11px] text-muted-foreground">
                Satu rencana perbaikan per baris — sebutkan yang bisa dikerjakan, bukan sifatnya.
              </p>
            </div>
          </div>
        </Step>

        {/* 5 · Catatan internal — terlipat, tapi tetap ter-render supaya ikut terkirim */}
        <Step
          no={5}
          title="Catatan internal"
          sub="Hanya pengurus — tidak ikut tercetak di rapor guru"
          collapsible
          defaultOpen={Boolean(existing?.notes)}
        >
          <Textarea name="notes" className="rounded-xl" defaultValue={existing?.notes ?? ''} placeholder="Catatan pembinaan, konteks, atau kesepakatan dengan guru..." />
        </Step>
      </div>

      {/* Nilai berjalan — ikut berubah selagi diketik */}
      <aside className="rounded-2xl border bg-card p-5 lg:sticky lg:top-4" aria-label={`Nilai berjalan ${teacherName}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Nilai berjalan</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-heading text-6xl leading-none tabular-nums text-primary">
            {hasil.rapot.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
          </span>
          <span className="text-sm text-muted-foreground">/ 100 · {hasil.predikat}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Level {hasil.level} · total {Math.round(hasil.total * 10) / 10} · {monthLabel} {year}
        </p>

        <ul className="mt-4 space-y-2.5">
          {hasil.nilai.map((n, i) => {
            const v = Math.round(n * 10) / 10
            return (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate" title={KPI_INDIKATOR[i]}>{KPI_INDIKATOR[i]}</span>
                  <b className="tabular-nums">{v}</b>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', v >= 81 ? 'bg-primary' : v >= 71 ? 'bg-warning' : 'bg-accent-warm')}
                    style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{hasil.tindakLanjut}</p>

        {state?.error && (
          <p className="mt-3 rounded-lg bg-destructive-wash px-3 py-2 text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" disabled={isPending} className="mt-4 h-11 w-full rounded-xl font-bold">
          {isPending ? 'Menyimpan...' : 'Simpan Nilai KPI'}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Ajukan ke koordinator dari halaman rekap KPI setelah tersimpan.
        </p>
      </aside>
    </form>
  )
}

const LABEL_LANGSUNG: Record<KunciLangsung, string> = {
  hadir: 'Kedisiplinan hadir',
  database: 'Pengisian database',
  bukuPegangan: 'Buku pegangan',
  perizinan: 'Perizinan',
  pengganti: 'Mencari pengganti',
}

/**
 * Kartu langkah bernomor. Saat dilipat, isinya hanya disembunyikan (bukan
 * dilepas dari DOM) supaya input di dalamnya tetap ikut terkirim.
 */
function Step({
  no, title, sub, done, collapsible, defaultOpen = true, children,
}: {
  no: number
  title: string
  sub: string
  done?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true)
  const head = (
    <>
      <span className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        done ? 'bg-primary text-primary-foreground' : 'bg-accent-warm-wash text-accent-warm',
      )}>
        {done ? <Check className="h-4 w-4" /> : no}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-heading text-xl leading-tight">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </>
  )
  return (
    <section className="rounded-2xl border bg-card">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-5 py-4"
        >
          {head}
          <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        </button>
      ) : (
        <div className="flex items-center gap-3 px-5 pt-4">{head}</div>
      )}
      <div className={cn('px-5 pb-5 pt-4', !open && 'hidden')}>{children}</div>
    </section>
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
/**
 * Baris tersimpan disamakan panjangnya dengan rubrik yang berlaku sekarang.
 *
 * Perlu karena panjangnya pernah berubah: Laporan Grup Orang Tua dulu dicatat
 * 20 hari, sekarang 16 hari aktif. Tanpa penyamaan ini, grid menggambar 20
 * kotak dari data lama sementara penyimpanan hanya membaca 16 — empat hari
 * yang terlihat di layar akan hilang diam-diam begitu SDM menekan simpan.
 *
 * Kelebihannya dipotong, kekurangannya diisi nol. Keduanya kasat mata di layar
 * sebelum disimpan, jadi SDM bisa membetulkannya kalau ternyata keliru.
 */
function sepanjang(tersimpan: number[] | null | undefined, panjang: number): number[] {
  const out = Array(panjang).fill(0)
  if (tersimpan) {
    for (let i = 0; i < Math.min(tersimpan.length, panjang); i++) out[i] = tersimpan[i]
  }
  return out
}

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
