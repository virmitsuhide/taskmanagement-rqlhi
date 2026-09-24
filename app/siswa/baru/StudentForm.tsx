'use client'

import { useActionState, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, GraduationCap, Phone, UserRound, type LucideIcon } from 'lucide-react'
import { createStudentAction, updateStudentAction } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { methodsForJenjang } from '@/lib/tahsin'
import { getProgramsForJenjang } from '@/lib/rq/programs'
import type { Jenjang, Halaqoh, TahsinMethod, JilidLevel } from '@/types'

// Radix Select melarang SelectItem value="". Pakai sentinel ini untuk opsi "kosong".
// Server action mengubah 'none' kembali menjadi null.
const NONE = 'none'

// Kontrol bawaan shadcn setinggi 32px — terlalu kecil untuk jempol. Di HP
// dibuat 40px, di layar lebar 36px. SelectTrigger juga dipaksa selebar kolom
// (bawaannya w-fit, sehingga dropdown menciut tak sejajar dengan input).
const CONTROL = 'h-10 w-full md:h-9'
// Tinggi SelectTrigger dikunci lewat data-[size=default]:h-8, yang lebih
// spesifik daripada h-* biasa — jadi harus ditimpa dengan varian yang sama.
const SELECT = 'w-full data-[size=default]:h-10 md:data-[size=default]:h-9'

interface Props {
  mode: 'create' | 'edit'
  allowedJenjang: Jenjang[]
  /**
   * Nilai program yang boleh dipilih pengurus ini, per jenjang. `null` di
   * dalam daftar berarti "boleh dibiarkan kosong".
   */
  allowedPrograms: Partial<Record<Jenjang, (string | null)[]>>
  halaqohList: Pick<Halaqoh, 'id' | 'name' | 'jenjang' | 'program'>[]
  methods: Pick<TahsinMethod, 'id' | 'name'>[]
  jilidLevels: Pick<JilidLevel, 'id' | 'label' | 'method_id' | 'order_num'>[]
  initial?: {
    id: string
    nis: string | null
    full_name: string
    gender: 'L' | 'P' | null
    birth_date: string | null
    jenjang: Jenjang
    kelas: string | null
    program: string | null
    halaqoh_id: string | null
    wali_name: string | null
    wali_phone: string | null
    wali_email: string | null
    current_method_id: string | null
    current_jilid_id: string | null
    current_jilid_page: number | null
    is_active: boolean
  }
  defaultHalaqohId?: string
}

export function StudentForm({
  mode, allowedJenjang, allowedPrograms, halaqohList, methods, jilidLevels, initial, defaultHalaqohId,
}: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createStudentAction : updateStudentAction
  const [state, formAction, isPending] = useActionState(action, null)

  const bolehProgramUntuk = (j: Jenjang) => allowedPrograms[j] ?? [null]
  const programAwal = (j: Jenjang, sekarang: string | null | undefined): string => {
    const boleh = bolehProgramUntuk(j)
    if (sekarang && boleh.includes(sekarang)) return sekarang
    if (!sekarang && boleh.includes(null)) return NONE
    return boleh.find((x): x is string => x !== null) ?? NONE
  }

  const [jenjang, setJenjang] = useState<Jenjang>(initial?.jenjang ?? allowedJenjang[0] ?? 'sd')
  const [program, setProgram] = useState<string>(
    programAwal(initial?.jenjang ?? allowedJenjang[0] ?? 'sd', initial?.program),
  )
  const [methodId, setMethodId] = useState<string>(initial?.current_method_id ?? NONE)

  const bolehProgram = bolehProgramUntuk(jenjang)
  const programOptions = useMemo(
    () => getProgramsForJenjang(jenjang).filter(p => bolehProgram.includes(p.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jenjang, allowedPrograms],
  )
  const bolehTanpaProgram = bolehProgram.includes(null)

  // Halaqoh disaring ikut programnya juga: kelompok QULS dan kelompok reguler
  // duduk di unit dan sesi yang sama, jadi jenjang saja tidak memisahkannya.
  const halaqohOptions = useMemo(
    () => halaqohList.filter(h => h.jenjang === jenjang && bolehProgram.includes(h.program ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [halaqohList, jenjang, allowedPrograms],
  )

  // Metode tahsin yang berlaku untuk unit DAN program terpilih (kebijakan RQ
  // LHI). SD memakai UMMI & KIBAR, tapi kelompok QULS SD seluruhnya KIBAR —
  // jadi mengganti program bisa menyempitkan pilihan ini.
  const programKini = program === NONE ? null : program
  const availableMethods = useMemo(
    () => methodsForJenjang(jenjang, methods, programKini),
    [jenjang, methods, programKini],
  )
  const jilidOptions = useMemo(
    () => (methodId === NONE ? [] : jilidLevels.filter(j => j.method_id === methodId).sort((a, b) => a.order_num - b.order_num)),
    [jilidLevels, methodId],
  )

  /** Buang metode terpilih kalau ia tak lagi berlaku untuk unit/program baru. */
  function rapikanMetode(j: Jenjang, p: string | null) {
    if (methodId !== NONE && !methodsForJenjang(j, methods, p).some(m => m.id === methodId)) {
      setMethodId(NONE)
    }
  }

  function onJenjangChange(v: Jenjang) {
    setJenjang(v)
    const programBaru = programAwal(v, programKini)
    setProgram(programBaru)
    rapikanMetode(v, programBaru === NONE ? null : programBaru)
  }

  function onProgramChange(v: string) {
    setProgram(v)
    rapikanMetode(jenjang, v === NONE ? null : v)
  }

  return (
    <form action={formAction} className="space-y-4 sm:space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Section icon={UserRound} title="Identitas" description="Data diri siswa.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Nama Lengkap" htmlFor="full_name" required>
            <Input id="full_name" name="full_name" required autoComplete="off" placeholder="Nama sesuai akta" defaultValue={initial?.full_name ?? ''} disabled={isPending} className={CONTROL} />
          </Field>
          <Field label="NIS" htmlFor="nis">
            <Input id="nis" name="nis" inputMode="numeric" autoComplete="off" placeholder="Opsional" defaultValue={initial?.nis ?? ''} disabled={isPending} className={cn(CONTROL, 'tabular-nums')} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="min-w-0 space-y-1.5" disabled={isPending}>
            <legend className="mb-1.5 text-sm font-medium leading-none">Jenis Kelamin</legend>
            {/* Dua pilihan saja — tombol segmen lebih cepat disentuh di HP
                daripada membuka dropdown. Tak dipilih = dikirim kosong (null). */}
            <div className="grid grid-cols-2 gap-2">
              {([['L', 'Laki-laki'], ['P', 'Perempuan']] as const).map(([v, label]) => (
                <label key={v} className="relative cursor-pointer">
                  <input type="radio" name="gender" value={v} defaultChecked={initial?.gender === v} className="peer sr-only" />
                  <span className="flex h-10 items-center justify-center rounded-lg border border-input text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 md:h-9 dark:bg-input/30 dark:peer-checked:bg-primary/20">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Tanggal Lahir" htmlFor="birth_date">
            <Input id="birth_date" name="birth_date" type="date" defaultValue={initial?.birth_date ?? ''} disabled={isPending} className={cn(CONTROL, 'dark:[color-scheme:dark]')} />
          </Field>
        </div>
      </Section>

      <Section icon={GraduationCap} title="Akademik" description="Unit, kelas, program, dan halaqoh.">
        {mode === 'create' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Jenjang" htmlFor="jenjang" required>
              <Select name="jenjang" value={jenjang} onValueChange={v => onJenjangChange(v as Jenjang)}>
                <SelectTrigger id="jenjang" className={SELECT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedJenjang.map(j => (
                    <SelectItem key={j} value={j}>{JENJANG_LABELS[j]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Kelas" htmlFor="kelas">
              <Input id="kelas" name="kelas" placeholder="contoh: 4A" defaultValue={initial?.kelas ?? ''} disabled={isPending} className={CONTROL} />
            </Field>
          </div>
        ) : (
          // Jenjang tetap disebut sebagai keterangan: pilihan program,
          // halaqoh, dan metode tahsin di bawah semuanya bergantung padanya,
          // jadi menghilangkannya sama sekali membuat daftar yang menyempit
          // terasa tanpa sebab.
          <Field
            label="Kelas"
            htmlFor="kelas"
            hint={<>Unit <span className="font-medium text-foreground">{JENJANG_LABELS[jenjang]}</span> &middot; ikut kelas, tidak diubah dari sini.</>}
          >
            <Input id="kelas" name="kelas" placeholder="contoh: 4A" defaultValue={initial?.kelas ?? ''} disabled={isPending} className={CONTROL} />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {programOptions.length > 0 && (
            <Field
              label="Program"
              htmlFor="program"
              required={!bolehTanpaProgram}
              hint={availableMethods.length === 1 ? `Program ini memakai metode ${availableMethods[0].name}.` : undefined}
            >
              <Select name="program" value={program} onValueChange={onProgramChange}>
                <SelectTrigger id="program" className={SELECT}><SelectValue placeholder="— Belum ditandai —" /></SelectTrigger>
                <SelectContent>
                  {bolehTanpaProgram && <SelectItem value={NONE}>— Belum ditandai —</SelectItem>}
                  {programOptions.map(p => (
                    <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field
            label="Halaqoh"
            htmlFor="halaqoh_id"
            className={programOptions.length > 0 ? undefined : 'sm:col-span-2'}
            hint={halaqohOptions.length === 0 ? 'Belum ada halaqoh untuk unit/program ini.' : undefined}
          >
            <Select name="halaqoh_id" defaultValue={initial?.halaqoh_id ?? defaultHalaqohId ?? NONE}>
              <SelectTrigger id="halaqoh_id" className={SELECT}>
                <SelectValue placeholder="Pilih halaqoh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Belum ditentukan —</SelectItem>
                {halaqohOptions.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        icon={BookOpen}
        title="Tahsin Awal"
        description="Posisi tahsin saat siswa masuk. Boleh dikosongkan — nanti terisi lewat setoran."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_120px]">
          <Field label="Metode" htmlFor="current_method_id" className="col-span-2 sm:col-span-1">
            <Select name="current_method_id" value={methodId} onValueChange={setMethodId}>
              <SelectTrigger id="current_method_id" className={SELECT}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {availableMethods.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Jilid" htmlFor="current_jilid_id">
            <Select
              name="current_jilid_id"
              defaultValue={initial?.current_jilid_id ?? NONE}
              disabled={methodId === NONE || jilidOptions.length === 0}
            >
              <SelectTrigger id="current_jilid_id" className={SELECT}><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {jilidOptions.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Halaman" htmlFor="current_jilid_page">
            <Input
              id="current_jilid_page"
              name="current_jilid_page"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="—"
              defaultValue={initial?.current_jilid_page ?? ''}
              disabled={isPending}
              className={cn(CONTROL, 'tabular-nums')}
            />
          </Field>
        </div>
      </Section>

      <Section icon={Phone} title="Wali Murid" description="Kontak untuk laporan perkembangan siswa.">
        <Field label="Nama Wali" htmlFor="wali_name">
          <Input id="wali_name" name="wali_name" autoComplete="off" defaultValue={initial?.wali_name ?? ''} disabled={isPending} className={CONTROL} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="No. HP / WA" htmlFor="wali_phone">
            <Input id="wali_phone" name="wali_phone" type="tel" inputMode="tel" placeholder="08xx" defaultValue={initial?.wali_phone ?? ''} disabled={isPending} className={cn(CONTROL, 'tabular-nums')} />
          </Field>
          <Field label="Email" htmlFor="wali_email">
            <Input id="wali_email" name="wali_email" type="email" inputMode="email" placeholder="Opsional" defaultValue={initial?.wali_email ?? ''} disabled={isPending} className={CONTROL} />
          </Field>
        </div>
      </Section>

      {mode === 'edit' && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5 sm:p-5">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
            disabled={isPending}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold">Siswa aktif</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Siswa nonaktif hilang dari daftar kelas dan tidak bisa disetori,
              tapi seluruh riwayat tahsin, tahfidz, dan rapornya tetap tersimpan.
            </span>
          </span>
        </label>
      )}

      {state?.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Di HP tombol ditumpuk selebar layar, aksi utama di atas agar dekat jempol. */}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:justify-start">
        <Button type="submit" disabled={isPending} className="h-11 w-full sm:h-9 sm:w-auto sm:px-5">
          {isPending ? 'Menyimpan...' : mode === 'create' ? 'Tambah Siswa' : 'Simpan Perubahan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending} className="h-11 w-full sm:h-9 sm:w-auto">
          Batal
        </Button>
      </div>
    </form>
  )
}

function Section({ icon: Icon, title, description, children }: {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
      <header className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3 sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 pt-1">
          <h2 className="font-heading text-lg font-medium leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, required, hint, className, children }: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="gap-1">
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
