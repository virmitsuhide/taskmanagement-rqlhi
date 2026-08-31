'use client'

import { useActionState } from 'react'
import { createEmployeeAction, updateEmployeeAccountAction } from '@/app/actions/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'
import type { Employee, TeacherEmployment } from '@/types'

/**
 * Akun & kepegawaian karyawan. Data dirinya disunting lewat form profil
 * terpisah di halaman yang sama — dipisah karena keduanya beda wewenang dan
 * beda irama: akun jarang berubah, profil sering.
 */
type FormState = { error?: string; success?: boolean; message?: string } | null

export function EmployeeForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit'
  initial?: Employee
}) {
  // createEmployeeAction berakhir dengan redirect(), jadi TypeScript
  // menyimpulkan kembaliannya hanya cabang galat. Bentuk state-nya dinyatakan
  // eksplisit supaya kedua action muat dalam satu useActionState.
  const kirim = (mode === 'create' ? createEmployeeAction : updateEmployeeAccountAction) as
    (state: FormState, fd: FormData) => Promise<FormState>

  const [state, action, isPending] = useActionState<FormState, FormData>(kirim, null)

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nama Lengkap &amp; Gelar</Label>
          <Input id="full_name" name="full_name" defaultValue={initial?.full_name ?? ''} required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jabatan">Jabatan</Label>
          <Input id="jabatan" name="jabatan" defaultValue={initial?.jabatan ?? ''} placeholder="Bendahara" disabled={isPending} />
        </div>
      </div>

      {mode === 'create' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" placeholder="dewi_maghfiroh" required disabled={isPending} />
            <p className="text-[11px] text-muted-foreground">Huruf kecil, angka, dan underscore.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="text" placeholder="dibuatkan otomatis bila kosong" disabled={isPending} />
            <p className="text-[11px] text-muted-foreground">Minimal 8 karakter.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="nip">NIP / ID Karyawan</Label>
          <Input id="nip" name="nip" defaultValue={initial?.nip ?? ''} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" defaultValue={initial?.phone ?? ''} placeholder="08xx" disabled={isPending} />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Kepegawaian</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="employment_type">Jenis kepegawaian</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="joined_at">TMT (terhitung mulai tanggal)</Label>
            <Input id="joined_at" name="joined_at" type="date" defaultValue={initial?.joined_at ?? ''} disabled={isPending} />
            <p className="text-[11px] text-muted-foreground">Boleh dikosongkan kalau belum diketahui.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract_start">Mulai kontrak</Label>
            <Input id="contract_start" name="contract_start" type="date" defaultValue={initial?.contract_start ?? ''} disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract_end">Akhir kontrak</Label>
            <Input id="contract_end" name="contract_end" type="date" defaultValue={initial?.contract_end ?? ''} disabled={isPending} />
            <p className="text-[11px] text-muted-foreground">
              Kosongkan untuk pegawai tetap. Kalau diisi, akses login berhenti sehari setelahnya.
            </p>
          </div>
        </div>
      </fieldset>

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={initial?.is_active ?? true} disabled={isPending} />
          Akun aktif (bisa login)
        </label>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.message}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan…' : mode === 'create' ? 'Buat Akun' : 'Simpan'}
      </Button>
    </form>
  )
}
