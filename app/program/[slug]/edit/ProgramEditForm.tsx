'use client'

import { useActionState } from 'react'
import { updateProgramDetailAction } from '@/app/actions/program'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ProgramDetail } from '@/types'

type FormState = { error?: string } | null

interface Props {
  slug: string
  defaultValues: ProgramDetail | null
}

export function ProgramEditForm({ slug, defaultValues }: Props) {
  const boundAction = updateProgramDetailAction.bind(null, slug)
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    boundAction,
    null,
  )

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="long_description">Deskripsi Program</Label>
        <Textarea
          id="long_description"
          name="long_description"
          rows={6}
          placeholder="Paragraf panjang menjelaskan program: latar belakang, tujuan, pendekatan, hasil yang diharapkan…"
          defaultValue={defaultValues?.long_description ?? ''}
        />
        <p className="text-xs text-muted-foreground">
          Bagian utama yang akan dilihat pengunjung di halaman detail.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="curriculum">Kurikulum & Materi</Label>
        <Textarea
          id="curriculum"
          name="curriculum"
          rows={5}
          placeholder={'Materi/kurikulum yang dipelajari, misalnya:\n- Tahsin dasar\n- Ilmu tajwid\n- Hafalan juz 30'}
          defaultValue={defaultValues?.curriculum ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="schedule">Jadwal & Durasi</Label>
        <Textarea
          id="schedule"
          name="schedule"
          rows={3}
          placeholder="Contoh: Senin–Kamis, 15.30–17.00 WIB · Durasi 6 bulan per level"
          defaultValue={defaultValues?.schedule ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target_audience">Target Peserta</Label>
        <Textarea
          id="target_audience"
          name="target_audience"
          rows={3}
          placeholder="Untuk siapa program ini ditujukan: anak SD/SMP, remaja, dewasa, guru, dst."
          defaultValue={defaultValues?.target_audience ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact_info">Kontak & Pendaftaran</Label>
        <Textarea
          id="contact_info"
          name="contact_info"
          rows={3}
          placeholder="WhatsApp, email, atau cara pendaftaran lainnya."
          defaultValue={defaultValues?.contact_info ?? ''}
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
