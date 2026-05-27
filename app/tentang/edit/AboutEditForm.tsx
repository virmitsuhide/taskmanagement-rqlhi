'use client'

import { useActionState } from 'react'
import { updateAboutRqAction } from '@/app/actions/about'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AboutRq } from '@/types'

type FormState = { error?: string } | null

interface Props {
  defaultValues: AboutRq | null
}

export function AboutEditForm({ defaultValues }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateAboutRqAction,
    null,
  )

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="vision">Visi</Label>
        <Textarea
          id="vision"
          name="vision"
          rows={4}
          placeholder="Visi Rumah Qur'an LHI — pernyataan singkat tentang cita-cita jangka panjang."
          defaultValue={defaultValues?.vision ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mission">Misi</Label>
        <Textarea
          id="mission"
          name="mission"
          rows={6}
          placeholder={'Tulis misi sebagai daftar, satu poin per baris. Contoh:\n1. Menyelenggarakan pembelajaran tahsin yang berkualitas\n2. Membentuk generasi Qur’ani\n3. ...'}
          defaultValue={defaultValues?.mission ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="history">Sejarah RQ</Label>
        <Textarea
          id="history"
          name="history"
          rows={10}
          placeholder="Narasi sejarah Rumah Qur'an LHI — latar belakang berdiri, tahun pendirian, perkembangan, tokoh-tokoh penting."
          defaultValue={defaultValues?.history ?? ''}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-1 pb-8">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
      </div>
    </form>
  )
}
