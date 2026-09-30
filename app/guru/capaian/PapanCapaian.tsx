'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, Check, Pencil, Repeat2 } from 'lucide-react'
import {
  carryOverMonthlyAction, rangkumBulanAction, saveStudentMonthlyAction,
} from '@/app/actions/student-monthly'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { formatPeriod, monthName } from '@/lib/finance/period'
import { angkaHalaman, type RekapMurojaah } from '@/lib/rq/murojaah'
import { cn } from '@/lib/utils'
import type { StudentMonthly } from '@/types'

interface Student {
  id: string
  full_name: string
  kelas: string | null
  level_awal: string
}

interface Props {
  period: string
  previousPeriod: string
  activeHalaqohId: string
  students: Student[]
  monthly: Record<string, StudentMonthly>
  /** Halaman muroja'ah bulan ini per siswa (volume baca), dihitung dari setoran. */
  murojaah: Record<string, RekapMurojaah>
}

/** Kolom tabel di layar lebar; di ponsel tiap anak menjadi kartu. */
const KOLOM = 'lg:grid lg:grid-cols-[1.25fr_0.45fr_1.3fr_1.3fr_0.4fr_1.15fr_1fr_0.75fr_2.75rem] lg:items-center lg:gap-3'

/**
 * Papan capaian awal & akhir bulan satu halaqoh — pengganti lembar DB Y1–Y6.
 * Baris yang sedang diisi terbuka di tempat, tepat di bawah nama anaknya.
 */
export function PapanCapaian({ period, previousPeriod, activeHalaqohId, students, monthly, murojaah }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /*
    Merangkum bulan ini dari setoran harian.

    Sengaja tombol, bukan otomatis saat bulan berganti. Merangkum menimpa
    kolom akhir, jumlah halaman, ujian, dan total hafalan — kalau ia berjalan
    sendiri, koreksi yang sudah diketik guru bisa terhapus oleh setoran susulan
    yang dimasukkan kemudian, tanpa ada yang menekan apa pun.
  */
  function rangkum() {
    startTransition(async () => {
      const result = await rangkumBulanAction(activeHalaqohId, period)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.dirangkum} siswa dirangkum dari setoran harian` +
        (result.dilewati ? ` · ${result.dilewati} belum ada setorannya` : ''),
      )
      router.refresh()
    })
  }

  async function carryOver() {
    const ok = await confirm({
      title: `Salin capaian akhir ${formatPeriod(previousPeriod)} menjadi capaian awal ${formatPeriod(period)}?`,
      description:
        'Hanya kolom AWAL yang diisi; kolom akhir dibiarkan kosong agar terlihat ' +
        'mana yang belum dinilai bulan ini.',
      confirmText: 'Salin capaian',
      tone: 'default',
    })
    if (!ok) return

    startTransition(async () => {
      const result = await carryOverMonthlyAction(activeHalaqohId, period, previousPeriod)
      if (result?.error) toast.error(result.error)
      else toast.success('Capaian awal terisi dari bulan lalu')
    })
  }

  const terisi = students.filter(s => monthly[s.id]?.halaman_akhir_tahsin).length
  const persen = students.length ? Math.round((terisi / students.length) * 100) : 0

  return (
    <div className="space-y-5">
      {/* ── Kemajuan bulan ini + aksi massal ── */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:flex-row md:items-center md:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {terisi} dari {students.length} siswa sudah punya capaian akhir {monthName(period)}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${persen}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:shrink-0">
          <button
            type="button"
            disabled={pending || students.length === 0}
            onClick={rangkum}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-accent disabled:opacity-50"
          >
            <Repeat2 className="size-4" /> Rangkum dari setoran
          </button>
          <button
            type="button"
            disabled={pending || students.length === 0}
            onClick={carryOver}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-accent disabled:opacity-50"
          >
            <CalendarDays className="size-4" /> Isi awal dari {monthName(previousPeriod)}
          </button>
        </div>
      </div>

      {/* ── Tabel (lebar) / kartu (ponsel) ── */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className={cn('hidden border-b px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground', KOLOM)}>
          <span>Nama</span>
          <span>Level</span>
          <span>Tahsin awal → akhir</span>
          <span>Tahfidz awal → akhir</span>
          <span className="text-right">Hal.</span>
          <span>Total hafalan</span>
          <span title="Halaman yang dibaca ulang bulan ini — tiap setoran dijumlah">Muroja&apos;ah</span>
          <span>Ujian</span>
          <span />
        </div>

        <ul className="divide-y">
          {students.map(student => {
            const row = monthly[student.id]
            const buka = editing === student.id
            return (
              <li key={student.id} className={cn(buka && 'bg-muted/40')}>
                <div className={cn('px-4 py-3.5 lg:px-5', KOLOM)}>
                  {/* Nama + tombol isi (di ponsel sebaris) */}
                  <div className="flex items-start justify-between gap-2 lg:block">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.kelas ?? '—'}
                        <span className="lg:hidden"> · Level {row?.level || student.level_awal || '—'}</span>
                      </p>
                    </div>
                    <TombolIsi nama={student.full_name} buka={buka} className="flex lg:hidden"
                      onClick={() => setEditing(buka ? null : student.id)} />
                  </div>

                  <p className="hidden text-sm font-bold lg:block">{row?.level || student.level_awal || '—'}</p>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:contents">
                    <Sel label="Tahsin"><Arrow from={row?.halaman_awal_tahsin} to={row?.halaman_akhir_tahsin} /></Sel>
                    <Sel label="Tahfidz"><Arrow from={row?.tahfidz_awal} to={row?.tahfidz_akhir} /></Sel>
                    <Sel label="Halaman" className="lg:text-right">
                      <span className="font-heading text-base font-semibold tabular-nums lg:text-lg">{row?.capaian_halaman || '—'}</span>
                    </Sel>
                    <Sel label="Total hafalan">
                      <span className="text-[13px] leading-snug">{row?.total_hafalan || '—'}</span>
                      {/* Penanda sumber. Angka hasil hitungan bisa ditelusuri ke
                          baris setoran hari itu; angka ketikan hanya bisa
                          ditanyakan kepada yang mengetiknya. */}
                      {row?.dari_setoran && (
                        <span className="mt-0.5 block w-fit rounded bg-primary-wash px-1.5 py-px text-[10px] font-bold text-primary">
                          dari setoran
                        </span>
                      )}
                    </Sel>
                    <Sel label="Muroja'ah"><SelMurojaah r={murojaah[student.id]} /></Sel>
                    <Sel label="Ujian"><span className="text-[13px]">{row?.ujian_tercatat || '—'}</span></Sel>
                  </dl>

                  <TombolIsi nama={student.full_name} buka={buka} className="hidden lg:flex"
                    onClick={() => setEditing(buka ? null : student.id)} />
                </div>

                {buka && (
                  <FormCapaian
                    period={period}
                    student={student}
                    record={row}
                    onDone={() => setEditing(null)}
                  />
                )}
              </li>
            )
          })}
          {students.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">Belum ada siswa di halaqoh ini.</li>
          )}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        &ldquo;dari setoran&rdquo; = total hafalan dihitung dari catatan setoran, bukan diketik.
      </p>
    </div>
  )
}

function TombolIsi({ nama, buka, onClick, className }: { nama: string; buka: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Isi capaian ${nama}`}
      aria-expanded={buka}
      className={cn(
        'size-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
        buka ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
        className,
      )}
    >
      <Pencil className="size-3.5" />
    </button>
  )
}

/** Satu sel: di ponsel berlabel, di tabel label disembunyikan. */
function Sel({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Halaman muroja'ah baru & lama bulan ini. Jenis yang nol tidak ditulis —
 * anak yang belum punya juz teruji memang tidak punya muroja'ah lama.
 */
function SelMurojaah({ r }: { r?: RekapMurojaah }) {
  if (!r || (r.kaliBaru === 0 && r.kaliLama === 0)) return <span className="text-muted-foreground">—</span>
  const bagian = [
    r.kaliBaru > 0 ? { l: 'baru', n: angkaHalaman(r.baru), kali: r.kaliBaru } : null,
    r.kaliLama > 0 ? { l: 'lama', n: angkaHalaman(r.lama), kali: r.kaliLama } : null,
  ].filter(Boolean) as { l: string; n: string; kali: number }[]
  return (
    <span className="text-[13px] text-muted-foreground">
      {bagian.map((b, i) => (
        <span key={b.l} title={`${b.kali}× setor · ${b.n} halaman`}>
          {i > 0 && ' · '}{b.l} <strong className="tabular-nums text-foreground">{b.n}</strong>
        </span>
      ))}
    </span>
  )
}

/** Titik awal → titik akhir. Akhir yang belum terisi ditandai "belum". */
function Arrow({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return <span className="text-muted-foreground">—</span>
  return (
    <span className="text-[13px] leading-snug">
      {from || <span className="text-muted-foreground">?</span>}
      {' → '}
      {to ? <strong className="text-primary">{to}</strong> : <strong className="text-accent-warm">belum</strong>}
    </span>
  )
}

function Kolom({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function FormCapaian({
  period, student, record, onDone,
}: {
  period: string
  student: Student
  record?: StudentMonthly
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveStudentMonthlyAction(prev, formData)
      if (result.success) {
        toast.success(`Capaian ${student.full_name} tersimpan`)
        onDone()
      }
      return result
    },
    null,
  )
  const nama = student.full_name.split(' ')[0]
  const f = (k: string) => `${k}-${student.id}`
  const kotak = 'h-11 rounded-xl bg-card'

  return (
    <form action={action} className="space-y-3 border-t border-dashed px-4 pb-4 pt-3 lg:px-5">
      <input type="hidden" name="student_id" value={student.id} />
      <input type="hidden" name="period" value={period} />

      {/* Yang paling sering diubah di baris pertama: titik akhir, halaman, catatan. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kolom id={f('halaman_akhir_tahsin')} label="Tahsin akhir bulan">
          <Input id={f('halaman_akhir_tahsin')} name="halaman_akhir_tahsin" className={kotak}
            defaultValue={record?.halaman_akhir_tahsin ?? ''} placeholder="mis. Jilid 3 hal 5" />
        </Kolom>
        <Kolom id={f('tahfidz_akhir')} label="Tahfidz akhir bulan">
          <Input id={f('tahfidz_akhir')} name="tahfidz_akhir" className={kotak}
            defaultValue={record?.tahfidz_akhir ?? ''} placeholder="mis. An-Naba ayat 40" />
        </Kolom>
        <Kolom id={f('capaian_halaman')} label="Jumlah halaman bulan ini">
          <Input id={f('capaian_halaman')} name="capaian_halaman" inputMode="numeric" className={kotak}
            defaultValue={record?.capaian_halaman || ''} placeholder="0" />
        </Kolom>
        <Kolom id={f('catatan')} label="Catatan">
          <Input id={f('catatan')} name="catatan" className={kotak} defaultValue={record?.catatan ?? ''} />
        </Kolom>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kolom id={f('halaman_awal_tahsin')} label="Tahsin awal bulan">
          <Input id={f('halaman_awal_tahsin')} name="halaman_awal_tahsin" className={kotak}
            defaultValue={record?.halaman_awal_tahsin ?? ''} placeholder="mis. Jilid 2 hal 23" />
        </Kolom>
        <Kolom id={f('tahfidz_awal')} label="Tahfidz awal bulan">
          <Input id={f('tahfidz_awal')} name="tahfidz_awal" className={kotak}
            defaultValue={record?.tahfidz_awal ?? ''} placeholder="mis. An-Naba ayat 10" />
        </Kolom>
        <Kolom id={f('level')} label="Level">
          <Input id={f('level')} name="level" className={kotak} defaultValue={record?.level ?? student.level_awal}
            placeholder="mis. Jilid 2 / Ghorib / Qur'an T1" />
        </Kolom>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone}
          className="inline-flex h-11 items-center rounded-xl border bg-card px-4 text-sm font-bold hover:bg-accent">
          Batal
        </button>
        <button type="submit" disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60">
          <Check className="size-4" />
          {pending ? 'Menyimpan…' : `Simpan capaian ${nama}`}
        </button>
      </div>
    </form>
  )
}
