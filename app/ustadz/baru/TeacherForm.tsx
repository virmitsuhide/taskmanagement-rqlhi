'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createTeacherAction, updateTeacherAction } from '@/app/actions/teachers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TEACHER_EMPLOYMENT_LABELS, type TeacherEmployment } from '@/types'

interface Props {
  mode: 'create' | 'edit'
  initial?: {
    id: string
    username: string
    full_name: string
    nip: string | null
    email: string | null
    phone: string | null
    is_active: boolean
    employment_type?: TeacherEmployment | null
    contract_start?: string | null
    contract_end?: string | null
  }
}

export function TeacherForm({ mode, initial }: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createTeacherAction : updateTeacherAction
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nama Lengkap *</Label>
          <Input
            id="full_name"
            name="full_name"
            required
            defaultValue={initial?.full_name ?? ''}
            disabled={isPending}
            placeholder="contoh: Ahmad Hidayat"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nip">NIP</Label>
          <Input id="nip" name="nip" defaultValue={initial?.nip ?? ''} disabled={isPending} />
        </div>
      </div>

      {mode === 'create' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              name="username"
              required
              pattern="[a-z0-9_]+"
              minLength={3}
              placeholder="contoh: ust_ahmad"
              disabled={isPending}
            />
            <p className="text-[11px] text-muted-foreground">Huruf kecil, angka, underscore</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (opsional)</Label>
            <Input
              id="password"
              name="password"
              minLength={8}
              placeholder="Kosongkan untuk generate otomatis"
              disabled={isPending}
            />
            <p className="text-[11px] text-muted-foreground">Min. 8 karakter. Generated jika kosong.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Username</Label>
          <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">@{initial?.username}</p>
          <p className="text-[11px] text-muted-foreground">Username tidak bisa diubah.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">No. HP / WA</Label>
          <Input id="phone" name="phone" defaultValue={initial?.phone ?? ''} disabled={isPending} placeholder="08xx" />
        </div>
      </div>

      {/* Kepegawaian — menentukan pos gaji sekaligus apakah aksesnya bisa
          kedaluwarsa. Guru kontrak RQ berganti tiap tahun ajaran, jadi tanggal
          kontraknya yang mencabut akses, bukan ingatan admin. */}
      <fieldset className="rounded-md border p-3 space-y-3">
        <legend className="px-1 text-sm font-medium">Kepegawaian</legend>

        <div className="space-y-1.5">
          <Label htmlFor="employment_type">Jenis guru</Label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={initial?.employment_type ?? ''}
            disabled={isPending}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">— belum ditentukan —</option>
            {(Object.keys(TEACHER_EMPLOYMENT_LABELS) as TeacherEmployment[]).map(key => (
              <option key={key} value={key}>{TEACHER_EMPLOYMENT_LABELS[key]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contract_start">Mulai kontrak</Label>
            <Input
              id="contract_start" name="contract_start" type="date"
              defaultValue={initial?.contract_start ?? ''} disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract_end">Akhir kontrak</Label>
            <Input
              id="contract_end" name="contract_end" type="date"
              defaultValue={initial?.contract_end ?? ''} disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Kosongkan untuk guru tetap. Kalau diisi, akses login otomatis
              berhenti sehari setelah tanggal ini.
            </p>
          </div>
        </div>
      </fieldset>

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initial?.is_active ?? true}
            disabled={isPending}
          />
          Guru aktif (bisa login ke /guru)
        </label>
      )}

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : mode === 'create' ? 'Buat Akun Guru' : 'Simpan Perubahan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}
