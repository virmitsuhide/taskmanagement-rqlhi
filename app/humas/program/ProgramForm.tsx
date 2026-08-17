'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PROGRAM_ACCENT_KEYS, PROGRAM_ACCENTS, PROGRAM_ICON_KEYS, programIcon } from '@/lib/programs/theme'
import type { Program, ProgramAccent } from '@/types'

type FormState = { error?: string } | null

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  defaultValues?: Program | null
  submitLabel?: string
}

export function ProgramForm({ action, defaultValues, submitLabel = 'Simpan' }: Props) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)

  const [icon, setIcon] = useState(defaultValues?.icon ?? 'BookOpen')
  const [accent, setAccent] = useState<ProgramAccent>(defaultValues?.accent ?? 'emerald')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const existingPhoto = defaultValues?.photo_url ?? null
  const showExisting = !!existingPhoto && !removePhoto && !photoPreview

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setPhotoPreview(null); return }
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
  }

  return (
    <form action={formAction} className="space-y-7">
      {/* Identitas */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Nama Program *</Label>
        <Input
          id="title" name="title" required
          placeholder="Contoh: Tahsin Metode UMMI"
          defaultValue={defaultValues?.title ?? ''}
        />
        {defaultValues && (
          <p className="text-xs text-muted-foreground">
            Alamat halaman tetap <code className="text-foreground">/program/{defaultValues.slug}</code> meski
            nama diubah, supaya tautan lama tidak putus.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Ringkasan *</Label>
        <Textarea
          id="description" name="description" rows={3} required
          placeholder="Satu–dua kalimat yang tampil di kartu beranda dan daftar program."
          defaultValue={defaultValues?.description ?? ''}
        />
      </div>

      {/* Foto */}
      <div className="space-y-2">
        <Label htmlFor="photo">Foto Program</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Tampil sebagai gambar artikel di beranda. Kalau kosong, dipakai gradasi warna aksen + ikon.
        </p>

        {(showExisting || photoPreview) && (
          <div className="relative w-full max-w-xs aspect-[16/10] rounded-lg overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview ?? existingPhoto ?? ''}
              alt="Pratinjau foto program"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <Input id="photo" name="photo" type="file" accept="image/*" onChange={onPhotoChange} />

        {existingPhoto && !photoPreview && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox" name="remove_photo" value="1"
              checked={removePhoto}
              onChange={e => setRemovePhoto(e.target.checked)}
            />
            Hapus foto yang sekarang
          </label>
        )}
      </div>

      {/* Ikon */}
      <div className="space-y-2">
        <Label>Ikon</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Dipakai di daftar program dan sebagai cadangan saat foto belum ada.
        </p>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-1.5">
          {PROGRAM_ICON_KEYS.map(key => {
            const Icon = programIcon(key)
            const active = icon === key
            return (
              <button
                key={key} type="button" onClick={() => setIcon(key)}
                title={key}
                aria-pressed={active}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Warna aksen */}
      <div className="space-y-2">
        <Label>Warna Aksen</Label>
        <input type="hidden" name="accent" value={accent} />
        <div className="flex flex-wrap gap-1.5">
          {PROGRAM_ACCENT_KEYS.map(key => {
            const active = accent === key
            return (
              <button
                key={key} type="button" onClick={() => setAccent(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${PROGRAM_ACCENTS[key].dot}`} />
                {PROGRAM_ACCENTS[key].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Isi halaman detail */}
      <div className="rounded-xl border bg-muted/20 p-4 md:p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Isi Halaman Detail</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bagian ini tampil di <code className="text-foreground">/program/…</code>. Boleh dikosongkan
            dulu — bagian yang kosong tidak ikut ditampilkan.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="long_description">Deskripsi Program</Label>
          <Textarea
            id="long_description" name="long_description" rows={6}
            placeholder="Latar belakang, tujuan, pendekatan, hasil yang diharapkan…"
            defaultValue={defaultValues?.long_description ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="curriculum">Kurikulum &amp; Materi</Label>
          <Textarea
            id="curriculum" name="curriculum" rows={5}
            placeholder={'Materi yang dipelajari, misalnya:\n- Tahsin dasar\n- Ilmu tajwid\n- Hafalan juz 30'}
            defaultValue={defaultValues?.curriculum ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule">Jadwal &amp; Durasi</Label>
          <Textarea
            id="schedule" name="schedule" rows={3}
            placeholder="Contoh: Senin–Kamis, 15.30–17.00 WIB · Durasi 6 bulan per level"
            defaultValue={defaultValues?.schedule ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="target_audience">Target Peserta</Label>
          <Textarea
            id="target_audience" name="target_audience" rows={3}
            placeholder="Untuk siapa program ini: anak SD/SMP, remaja, dewasa, guru, dst."
            defaultValue={defaultValues?.target_audience ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact_info">Kontak &amp; Pendaftaran</Label>
          <Textarea
            id="contact_info" name="contact_info" rows={3}
            placeholder="WhatsApp, email, atau cara pendaftaran lainnya."
            defaultValue={defaultValues?.contact_info ?? ''}
          />
        </div>
      </div>

      {/* Status terbit */}
      <label className="flex items-start gap-2.5 rounded-lg border p-3.5">
        <input
          type="checkbox" name="is_active" className="mt-0.5"
          defaultChecked={defaultValues ? defaultValues.is_active : true}
        />
        <span>
          <span className="block text-sm font-medium">Tampilkan di halaman publik</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Kalau dimatikan, program tetap tersimpan tapi tidak muncul di beranda maupun /program.
          </span>
        </span>
      </label>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-1 pb-8">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? 'Menyimpan…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
