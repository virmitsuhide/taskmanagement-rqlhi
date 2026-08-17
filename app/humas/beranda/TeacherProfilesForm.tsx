'use client'

import { useActionState, useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { updateTeacherProfilesAction } from '@/app/actions/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PublicTeacher } from '@/types'
import { FormFeedback } from './FormFeedback'

type FormState = { error?: string; success?: string } | null
type Row = PublicTeacher & { is_public: boolean }

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export function TeacherProfilesForm({ teachers }: { teachers: Row[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateTeacherProfilesAction,
    null,
  )
  const [query, setQuery] = useState('')

  // Pencarian hanya menyembunyikan baris secara visual — input-nya tetap ada di
  // DOM (hidden), supaya guru yang sedang tersaring tidak ikut ter-reset saat
  // form disubmit.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return new Set(teachers.filter(t => t.full_name.toLowerCase().includes(q)).map(t => t.id))
  }, [query, teachers])

  if (teachers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
        <Users className="h-7 w-7 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium">Belum ada data guru</p>
        <p className="text-xs text-muted-foreground mt-1">
          Akun guru dibuat oleh SDM lewat menu Ustadz.
        </p>
      </div>
    )
  }

  const publicCount = teachers.filter(t => t.is_public).length

  return (
    <form action={formAction} className="space-y-4 pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {publicCount} dari {teachers.length} guru sedang ditampilkan di halaman publik.
          Urutan kecil tampil lebih dulu.
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari nama guru…"
            className="pl-8 w-56"
            aria-label="Cari guru"
          />
        </div>
      </div>

      <div className="space-y-3">
        {teachers.map((teacher, i) => {
          const hidden = matches !== null && !matches.has(teacher.id)
          return (
            <div
              key={teacher.id}
              className={`rounded-xl border bg-card p-4 ${hidden ? 'hidden' : ''}`}
            >
              <input type="hidden" name="teacher_id" value={teacher.id} />

              <div className="flex items-start gap-3.5">
                <Avatar className="size-11 mt-0.5">
                  {teacher.photo_url && <AvatarImage src={teacher.photo_url} alt="" />}
                  <AvatarFallback className="text-xs font-semibold">
                    {initials(teacher.full_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-semibold text-sm">{teacher.full_name}</p>
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        name={`public_${teacher.id}`}
                        defaultChecked={teacher.is_public}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="text-xs">Tampilkan publik</span>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`title_${teacher.id}`} className="text-xs">Jabatan</Label>
                      <Input
                        id={`title_${teacher.id}`}
                        name={`title_${teacher.id}`}
                        defaultValue={teacher.public_title ?? ''}
                        placeholder="mis. Koordinator Tahsin SD"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`order_${teacher.id}`} className="text-xs">Urutan</Label>
                      <Input
                        id={`order_${teacher.id}`}
                        name={`order_${teacher.id}`}
                        type="number"
                        defaultValue={teacher.display_order ?? i}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`bio_${teacher.id}`} className="text-xs">Bio singkat</Label>
                    <Textarea
                      id={`bio_${teacher.id}`}
                      name={`bio_${teacher.id}`}
                      rows={2}
                      defaultValue={teacher.public_bio ?? ''}
                      placeholder="Latar pendidikan, pengalaman mengajar, atau amanah di RQ."
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {matches?.size === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Tidak ada guru bernama &ldquo;{query}&rdquo;.
        </p>
      )}

      <FormFeedback state={state} />

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Menyimpan…' : 'Simpan Profil Guru'}
      </Button>
    </form>
  )
}
