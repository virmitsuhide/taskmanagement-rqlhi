'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createTeacherAction, updateTeacherAction } from '@/app/actions/teachers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
