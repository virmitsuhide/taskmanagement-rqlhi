'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStudentAction, updateStudentAction } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { methodsForJenjang } from '@/lib/tahsin'
import { getProgramsForJenjang } from '@/lib/rq/programs'
import type { Jenjang, Halaqoh, TahsinMethod, JilidLevel } from '@/types'

// Radix Select melarang SelectItem value="". Pakai sentinel ini untuk opsi "kosong".
// Server action mengubah 'none' kembali menjadi null.
const NONE = 'none'

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
    <form action={formAction} className="space-y-5 max-w-2xl">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {/* Identitas */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold mb-2">Identitas</legend>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nama Lengkap *</Label>
            <Input id="full_name" name="full_name" required defaultValue={initial?.full_name ?? ''} disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nis">NIS</Label>
            <Input id="nis" name="nis" defaultValue={initial?.nis ?? ''} disabled={isPending} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gender">Jenis Kelamin</Label>
            <Select name="gender" defaultValue={initial?.gender ?? NONE}>
              <SelectTrigger id="gender"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">Tanggal Lahir</Label>
            <Input id="birth_date" name="birth_date" type="date" defaultValue={initial?.birth_date ?? ''} disabled={isPending} />
          </div>
        </div>
      </fieldset>

      {/* Akademik */}
      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-semibold mb-2">Akademik</legend>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="jenjang">Jenjang *</Label>
            <Select name="jenjang" value={jenjang} onValueChange={v => onJenjangChange(v as Jenjang)}>
              <SelectTrigger id="jenjang"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedJenjang.map(j => (
                  <SelectItem key={j} value={j}>{JENJANG_LABELS[j]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kelas">Kelas</Label>
            <Input id="kelas" name="kelas" placeholder="contoh: 4A" defaultValue={initial?.kelas ?? ''} disabled={isPending} />
          </div>
        </div>

        {programOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="program">Program{!bolehTanpaProgram && ' *'}</Label>
            <Select name="program" value={program} onValueChange={onProgramChange}>
              <SelectTrigger id="program"><SelectValue placeholder="— Belum ditandai —" /></SelectTrigger>
              <SelectContent>
                {bolehTanpaProgram && <SelectItem value={NONE}>— Belum ditandai —</SelectItem>}
                {programOptions.map(p => (
                  <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableMethods.length === 1 && (
              <p className="text-[11px] text-muted-foreground">
                Program ini memakai metode {availableMethods[0].name}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="halaqoh_id">Halaqoh</Label>
          <Select name="halaqoh_id" defaultValue={initial?.halaqoh_id ?? defaultHalaqohId ?? NONE}>
            <SelectTrigger id="halaqoh_id">
              <SelectValue placeholder={halaqohOptions.length ? 'Pilih halaqoh' : 'Tidak ada halaqoh untuk jenjang ini'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Belum ditentukan —</SelectItem>
              {halaqohOptions.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {/* Tahsin awal */}
      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-semibold mb-2">Tahsin Awal</legend>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Posisi tahsin saat siswa masuk. Bisa dikosongkan, diisi lewat setoran nanti.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="current_method_id">Metode</Label>
            <Select name="current_method_id" value={methodId} onValueChange={setMethodId}>
              <SelectTrigger id="current_method_id"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {availableMethods.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current_jilid_id">Jilid</Label>
            <Select
              name="current_jilid_id"
              defaultValue={initial?.current_jilid_id ?? NONE}
              disabled={methodId === NONE || jilidOptions.length === 0}
            >
              <SelectTrigger id="current_jilid_id"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {jilidOptions.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current_jilid_page">Halaman</Label>
            <Input
              id="current_jilid_page"
              name="current_jilid_page"
              type="number"
              min={1}
              defaultValue={initial?.current_jilid_page ?? ''}
              disabled={isPending}
            />
          </div>
        </div>
      </fieldset>

      {/* Wali */}
      <fieldset className="space-y-3 border-t pt-4">
        <legend className="text-sm font-semibold mb-2">Wali Murid</legend>

        <div className="space-y-1.5">
          <Label htmlFor="wali_name">Nama Wali</Label>
          <Input id="wali_name" name="wali_name" defaultValue={initial?.wali_name ?? ''} disabled={isPending} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wali_phone">No. HP / WA</Label>
            <Input id="wali_phone" name="wali_phone" placeholder="08xx" defaultValue={initial?.wali_phone ?? ''} disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wali_email">Email</Label>
            <Input id="wali_email" name="wali_email" type="email" defaultValue={initial?.wali_email ?? ''} disabled={isPending} />
          </div>
        </div>
      </fieldset>

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm border-t pt-4">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
            disabled={isPending}
          />
          Siswa aktif
        </label>
      )}

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : mode === 'create' ? 'Tambah Siswa' : 'Simpan Perubahan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}
