'use client'

import { useState, useActionState } from 'react'
import { updatePengurusProfileAction } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, UserRound } from 'lucide-react'
import type { PengurusProfile, TrainingEntry, AmanahEntry, AwardEntry } from '@/types'

const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'S1', 'S2', 'S3'] as const

/** Baris kosong dipakai saat pengguna menekan "Tambah". */
const EMPTY_TRAINING: TrainingEntry = { name: '', year: '', organizer: '' }
const EMPTY_AMANAH: AmanahEntry = { position: '', period: '' }
const EMPTY_AWARD: AwardEntry = { name: '', year: '' }

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function PengurusProfileForm({ profile }: { profile: PengurusProfile }) {
  const [state, action, pending] = useActionState(updatePengurusProfileAction, null)

  // Daftar dikelola sebagai state supaya baris bisa ditambah/dihapus. Nilainya
  // tetap dikirim lewat name= biasa, jadi server action membacanya dari FormData.
  const [competencies, setCompetencies] = useState<string[]>(
    profile.competencies?.length ? profile.competencies : [''],
  )
  const [trainings, setTrainings] = useState<TrainingEntry[]>(
    profile.trainings?.length ? profile.trainings : [EMPTY_TRAINING],
  )
  const [amanah, setAmanah] = useState<AmanahEntry[]>(
    profile.amanah_history?.length ? profile.amanah_history : [EMPTY_AMANAH],
  )
  const [awards, setAwards] = useState<AwardEntry[]>(
    profile.awards?.length ? profile.awards : [EMPTY_AWARD],
  )

  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photo_url)

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPhotoPreview(URL.createObjectURL(file))
  }

  return (
    <form action={action} className="space-y-8">
      {/* ── Foto & sapaan ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Identitas</h2>

        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo">Foto Profil</Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPhotoChange}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">JPG/PNG/WebP, maksimal 2 MB.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sapaan">Sapaan</Label>
            <select
              id="sapaan"
              name="sapaan"
              defaultValue={profile.sapaan ?? ''}
              className={inputCls}
            >
              <option value="">— pilih —</option>
              <option value="ust">Ust. (Ustadz)</option>
              <option value="usth">Usth. (Ustadzah)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nickname">Nama Panggilan</Label>
            <Input id="nickname" name="nickname" defaultValue={profile.nickname ?? ''} placeholder="Habib" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full_name">Nama Lengkap</Label>
          <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? profile.display_name} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nip">NIP</Label>
            <Input id="nip" name="nip" defaultValue={profile.nip ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current_amanah">Amanah Saat Ini</Label>
            <Input
              id="current_amanah"
              name="current_amanah"
              defaultValue={profile.current_amanah ?? ''}
              placeholder="Kepala Rumah Qur'an"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="birth_place">Tempat Lahir</Label>
            <Input id="birth_place" name="birth_place" defaultValue={profile.birth_place ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">Tanggal Lahir</Label>
            <Input id="birth_date" name="birth_date" type="date" defaultValue={profile.birth_date ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="education_level">Jenjang Pendidikan Formal</Label>
          <select
            id="education_level"
            name="education_level"
            defaultValue={profile.education_level ?? ''}
            className={inputCls}
          >
            <option value="">— pilih —</option>
            {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </section>

      {/* ── Kompetensi ────────────────────────────────────────── */}
      <RowSection
        title="Kompetensi yang Dimiliki"
        onAdd={() => setCompetencies([...competencies, ''])}
      >
        {competencies.map((c, i) => (
          <RowShell key={i} onRemove={() => setCompetencies(competencies.filter((_, x) => x !== i))}>
            <Input
              name="competency"
              defaultValue={c}
              placeholder="Tahsin metode UMMI"
              aria-label={`Kompetensi ${i + 1}`}
            />
          </RowShell>
        ))}
      </RowSection>

      {/* ── Diklat & pelatihan ────────────────────────────────── */}
      <RowSection
        title="Diklat & Pelatihan yang Pernah Diikuti"
        onAdd={() => setTrainings([...trainings, EMPTY_TRAINING])}
      >
        {trainings.map((t, i) => (
          <RowShell key={i} onRemove={() => setTrainings(trainings.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px_1fr]">
              <Input name="training_name" defaultValue={t.name} placeholder="Nama diklat" aria-label={`Nama diklat ${i + 1}`} />
              <Input name="training_year" defaultValue={t.year} placeholder="Tahun" aria-label={`Tahun diklat ${i + 1}`} />
              <Input name="training_organizer" defaultValue={t.organizer} placeholder="Penyelenggara" aria-label={`Penyelenggara diklat ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Riwayat amanah ────────────────────────────────────── */}
      <RowSection
        title="Riwayat Amanah Sebelumnya"
        onAdd={() => setAmanah([...amanah, EMPTY_AMANAH])}
      >
        {amanah.map((a, i) => (
          <RowShell key={i} onRemove={() => setAmanah(amanah.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
              <Input name="amanah_position" defaultValue={a.position} placeholder="Jabatan" aria-label={`Jabatan ${i + 1}`} />
              <Input name="amanah_period" defaultValue={a.period} placeholder="2020–2023" aria-label={`Periode ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Penghargaan ───────────────────────────────────────── */}
      <RowSection
        title="Penghargaan & Prestasi"
        onAdd={() => setAwards([...awards, EMPTY_AWARD])}
      >
        {awards.map((a, i) => (
          <RowShell key={i} onRemove={() => setAwards(awards.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
              <Input name="award_name" defaultValue={a.name} placeholder="Nama penghargaan" aria-label={`Penghargaan ${i + 1}`} />
              <Input name="award_year" defaultValue={a.year} placeholder="Tahun" aria-label={`Tahun penghargaan ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.message}</p>}

      <div className="sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t">
        <Button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Profil'}
        </Button>
      </div>
    </form>
  )
}

function RowSection({
  title, onAdd, children,
}: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />Tambah
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function RowShell({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">{children}</div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        aria-label="Hapus baris"
        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
