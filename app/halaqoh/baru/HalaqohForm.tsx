'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createHalaqohAction, updateHalaqohAction } from '@/app/actions/halaqoh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import type { Jenjang, Teacher } from '@/types'

interface Props {
  mode: 'create' | 'edit'
  allowedJenjang: Jenjang[]
  teachers: Pick<Teacher, 'id' | 'full_name'>[]
  initial?: {
    id: string
    name: string
    jenjang: Jenjang
    wali_teacher_id: string | null
    schedule_note: string | null
    is_active: boolean
  }
}

export function HalaqohForm({ mode, allowedJenjang, teachers, initial }: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createHalaqohAction : updateHalaqohAction
  const [state, formAction, isPending] = useActionState(action, null)

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

      <div className="space-y-1.5">
        <Label htmlFor="jenjang">Jenjang *</Label>
        <Select name="jenjang" defaultValue={initial?.jenjang ?? allowedJenjang[0]}>
          <SelectTrigger id="jenjang"><SelectValue placeholder="Pilih jenjang" /></SelectTrigger>
          <SelectContent>
            {allowedJenjang.map(j => (
              <SelectItem key={j} value={j}>{JENJANG_LABELS[j]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wali_teacher_id">Wali Halaqoh (Guru Utama)</Label>
        <Select name="wali_teacher_id" defaultValue={initial?.wali_teacher_id ?? ''}>
          <SelectTrigger id="wali_teacher_id"><SelectValue placeholder="Pilih guru wali" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">— Belum ditentukan —</SelectItem>
            {teachers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="schedule_note">Catatan Jadwal</Label>
        <Textarea
          id="schedule_note"
          name="schedule_note"
          rows={2}
          defaultValue={initial?.schedule_note ?? ''}
          placeholder="contoh: Senin-Jumat, 07:30 - 09:00"
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
