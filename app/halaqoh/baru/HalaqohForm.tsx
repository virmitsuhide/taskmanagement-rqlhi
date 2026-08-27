'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHalaqohAction, updateHalaqohAction } from '@/app/actions/halaqoh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { sesiLabel } from '@/lib/rq/sesi'
import { getProgramsForJenjang } from '@/lib/rq/programs'
import type { Jenjang, Teacher } from '@/types'

// Radix Select melarang SelectItem value="". Pakai sentinel ini untuk opsi
// "kosong"; server action mengubah 'none' kembali menjadi null.
const NONE = 'none'

interface Props {
  mode: 'create' | 'edit'
  allowedJenjang: Jenjang[]
  /**
   * Nilai program yang boleh dipilih pengurus ini, per jenjang. `null` di
   * dalam daftar berarti "boleh reguler / tanpa program".
   */
  allowedPrograms: Partial<Record<Jenjang, (string | null)[]>>
  teachers: Pick<Teacher, 'id' | 'full_name'>[]
  initial?: {
    id: string
    name: string
    jenjang: Jenjang
    program: string | null
    wali_teacher_id: string | null
    schedule_note: string | null
    sesi?: number | null
    tempat?: string | null
    is_active: boolean
  }
}

export function HalaqohForm({ mode, allowedJenjang, allowedPrograms, teachers, initial }: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createHalaqohAction : updateHalaqohAction
  const [state, formAction, isPending] = useActionState(action, null)

  const [jenjang, setJenjang] = useState<Jenjang>(initial?.jenjang ?? allowedJenjang[0] ?? 'sd')
  const [program, setProgram] = useState<string>(initial?.program ?? NONE)

  // Pilihan program disaring dua kali: taksonomi unitnya, lalu wewenang
  // pengurus. Menawarkan yang pasti ditolak server hanya membuang waktu.
  const bolehProgram = allowedPrograms[jenjang] ?? [null]
  const programOptions = useMemo(
    () => getProgramsForJenjang(jenjang).filter(p => bolehProgram.includes(p.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jenjang, allowedPrograms],
  )
  const bolehTanpaProgram = bolehProgram.includes(null)

  function onJenjangChange(v: Jenjang) {
    setJenjang(v)
    const boleh = allowedPrograms[v] ?? [null]
    if (program !== NONE && !boleh.includes(program)) {
      setProgram(boleh.find((x): x is string => x !== null) ?? NONE)
    } else if (program === NONE && !boleh.includes(null)) {
      setProgram(boleh.find((x): x is string => x !== null) ?? NONE)
    }
  }

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nama Halaqoh *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          placeholder="contoh: Halaqoh Abu Bakr"
          disabled={isPending}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="jenjang">Jenjang *</Label>
          <Select name="jenjang" value={jenjang} onValueChange={v => onJenjangChange(v as Jenjang)}>
            <SelectTrigger id="jenjang"><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
            <SelectContent>
              {allowedJenjang.map(j => (
                <SelectItem key={j} value={j}>{JENJANG_LABELS[j]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {programOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="program">Program</Label>
            <Select name="program" value={program} onValueChange={setProgram}>
              <SelectTrigger id="program"><SelectValue placeholder="— Reguler —" /></SelectTrigger>
              <SelectContent>
                {bolehTanpaProgram && <SelectItem value={NONE}>— Reguler —</SelectItem>}
                {programOptions.map(p => (
                  <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Menentukan siapa yang berwenang atas kelompok ini.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wali_teacher_id">Wali Halaqoh (Guru Utama)</Label>
        <Select name="wali_teacher_id" defaultValue={initial?.wali_teacher_id ?? 'none'}>
          <SelectTrigger id="wali_teacher_id"><SelectValue placeholder="Pilih guru wali" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Belum ditentukan —</SelectItem>
            {teachers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sesi">Sesi</Label>
          <select
            id="sesi"
            name="sesi"
            defaultValue={initial?.sesi ? String(initial.sesi) : ''}
            disabled={isPending}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">— belum ditentukan —</option>
            {[1, 2, 3].map(s => (
              <option key={s} value={s}>{sesiLabel(s)}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Jam mengikuti sesi, tidak diatur per halaqoh.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tempat">Tempat</Label>
          <Input
            id="tempat"
            name="tempat"
            defaultValue={initial?.tempat ?? ''}
            placeholder="contoh: Ruang Kelas 3A"
            disabled={isPending}
          />
          <p className="text-[11px] text-muted-foreground">
            Ruang bisa berpindah tanpa mengubah nama halaqoh.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="schedule_note">Catatan Jadwal (opsional)</Label>
        <Textarea
          id="schedule_note"
          name="schedule_note"
          rows={2}
          defaultValue={initial?.schedule_note ?? ''}
          placeholder="catatan tambahan di luar sesi & tempat"
          disabled={isPending}
        />
      </div>

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
            disabled={isPending}
          />
          Halaqoh aktif
        </label>
      )}

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : mode === 'create' ? 'Buat Halaqoh' : 'Simpan Perubahan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}
