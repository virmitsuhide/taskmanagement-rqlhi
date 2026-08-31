'use client'

import { useActionState, useState } from 'react'
import { updateGuruProfileBySdmAction, updateOwnGuruProfileAction } from '@/app/actions/teacher-profile'
import { updatePengurusOwnProfileAction } from '@/app/actions/profile'
import { updateOwnEmployeeProfileAction, updateEmployeeBySdmAction } from '@/app/actions/employee-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RowSection, RowShell } from './RowSection'
import { PhotoAdjuster } from './PhotoAdjuster'
import { parseFocus } from '@/lib/profil/foto'
import { EDUCATION_LEVELS, hasMajorField, institutionPlaceholder } from '@/lib/profil/pendidikan'
import { UNIT_PENUGASAN_LABELS } from '@/lib/auth/permissions'
import type {
  AmanahEntry, AwardEntry, CompetencyEntry, EmployeeProfile, GuruProfile, Jenjang, TrainingEntry,
} from '@/types'

/**
 * Form profil guru Qur'an.
 *
 * Satu komponen, dua peran. `scope='sdm'` menambahkan blok kepegawaian (unit,
 * TMT, NIP, jenis kepegawaian) dan menulis lewat action SDM; `scope='guru'`
 * hanya data diri dan menulis lewat action portal guru, yang mengambil id
 * gurunya dari sesi.
 *
 * Medan kepegawaian tidak sekadar disembunyikan pada scope guru — action-nya
 * memang tidak pernah membacanya (lihat app/actions/teacher-profile.ts), jadi
 * menyisipkannya lewat peralatan pengembang peramban tetap tidak berpengaruh.
 */

const EMPTY_TRAINING: TrainingEntry = { name: '', year: '', organizer: '' }
const EMPTY_AMANAH: AmanahEntry = { position: '', period: '' }
const EMPTY_AWARD: AwardEntry = { name: '', year: '' }
const EMPTY_COMPETENCY: CompetencyEntry = { name: '', institution: '' }

type EducationRow = {
  uid: number
  level: string
  institution: string
  major: string
  graduation_year: string
}

let eduUid = 0
function newEducationRow(init?: Partial<EducationRow>): EducationRow {
  return { uid: ++eduUid, level: '', institution: '', major: '', graduation_year: '', ...init }
}

const inputCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const UNITS: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

const EMPLOYMENT: { key: string; label: string }[] = [
  { key: 'tetap_yayasan', label: 'Tetap Yayasan' },
  { key: 'kontrak_yayasan', label: 'Kontrak Yayasan' },
  { key: 'kontrak_rq', label: 'Kontrak RQ' },
]

/**
 * Empat pintu masuk ke satu form.
 *
 *   sdm            SDM menyunting guru       — termasuk blok kepegawaian
 *   guru           guru menyunting dirinya   — data diri saja
 *   pengurus       pengurus lewat /profil    — data diri saja, ditulis ke
 *                                              rekam orang yang menduduki
 *                                              amanahnya (guru atau karyawan)
 *   karyawan       karyawan lewat portalnya  — data diri saja
 *   karyawan-sdm   admin menyunting karyawan — termasuk kepegawaian
 *
 * Blok kepegawaian tidak sekadar disembunyikan pada scope selain sdm: action-nya
 * memang tidak pernah membacanya, jadi menyisipkannya lewat peralatan pengembang
 * peramban tetap tidak berpengaruh.
 */
type Scope = 'sdm' | 'guru' | 'pengurus' | 'karyawan' | 'karyawan-sdm'

const ACTIONS = {
  sdm: updateGuruProfileBySdmAction,
  guru: updateOwnGuruProfileAction,
  pengurus: updatePengurusOwnProfileAction,
  karyawan: updateOwnEmployeeProfileAction,
  'karyawan-sdm': updateEmployeeBySdmAction,
} as const

interface Props {
  profile: GuruProfile | EmployeeProfile
  scope: Scope
}

export function GuruProfileForm({ profile, scope }: Props) {
  const [state, action, pending] = useActionState(
    ACTIONS[scope],
    null as { error?: string; success?: boolean; message?: string } | null,
  )

  const [education, setEducation] = useState<EducationRow[]>(() =>
    profile.education_history?.length
      ? profile.education_history.map(e => newEducationRow(e))
      : [newEducationRow()],
  )
  const [quranComps, setQuranComps] = useState<CompetencyEntry[]>(
    profile.quran_competencies?.length ? profile.quran_competencies : [EMPTY_COMPETENCY],
  )
  const [otherComps, setOtherComps] = useState<CompetencyEntry[]>(
    profile.other_competencies?.length ? profile.other_competencies : [EMPTY_COMPETENCY],
  )
  const [ijazahSanad, setIjazahSanad] = useState<string[]>(
    profile.ijazah_sanad?.length ? profile.ijazah_sanad : [''],
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

  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.photo_url ?? null)

  // Foto baru berarti bingkai lama tidak berlaku lagi: posisi yang pas untuk
  // foto sebelumnya hampir pasti salah untuk gambar yang komposisinya beda.
  // Mengganti key memaksa PhotoAdjuster memulai dari posisi tengah.
  const [adjusterKey, setAdjusterKey] = useState(0)

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setAdjusterKey(k => k + 1)
  }

  // Dua scope admin memakai blok kepegawaian; hanya yang karyawan menukar
  // Unit Penugasan dengan Jabatan.
  const karyawanScope = scope === 'karyawan-sdm'
  const adminScope = scope === 'sdm' || karyawanScope

  function patchEducation(index: number, patch: Partial<EducationRow>) {
    setEducation(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <form action={action} className="space-y-8">
      {scope === 'sdm' && <input type="hidden" name="teacher_id" value={profile.id} />}
      {scope === 'karyawan-sdm' && <input type="hidden" name="employee_id" value={profile.id} />}

      {/* ── Kepegawaian (admin saja) ─────────────────── */}
      {adminScope && (
        <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">Kepegawaian</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {karyawanScope
                ? 'Hanya admin yang bisa mengubah bagian ini.'
                : 'Hanya SDM yang bisa mengubah bagian ini. Unit menentukan rubrik KPI, TMT menentukan masa kerja yang tercetak di rapor bulanan.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama Lengkap &amp; Gelar</Label>
              <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nip">{karyawanScope ? 'NIP / ID Karyawan' : 'NIP / ID Guru'}</Label>
              <Input id="nip" name="nip" defaultValue={profile.nip ?? ''} placeholder="GQ-2023-014" />
            </div>
            {karyawanScope ? (
              <div className="space-y-1.5">
                <Label htmlFor="jabatan">Jabatan</Label>
                <Input
                  id="jabatan"
                  name="jabatan"
                  defaultValue={(profile as EmployeeProfile).jabatan ?? ''}
                  placeholder="Bendahara"
                />
                <p className="text-[11px] text-muted-foreground">
                  Posisi kerjanya. Berbeda dari amanah pengurus, yang ditetapkan Kepala RQ.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit Penugasan</Label>
                <select id="unit" name="unit" defaultValue={(profile as GuruProfile).unit ?? ''} className={inputCls}>
                  <option value="">— belum ditentukan —</option>
                  {UNITS.map(u => (
                    <option key={u} value={u}>{UNIT_PENUGASAN_LABELS[u]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="joined_at">TMT / Tanggal Bergabung</Label>
              <Input id="joined_at" name="joined_at" type="date" defaultValue={profile.joined_at ?? ''} />
              <p className="text-[11px] text-muted-foreground">
                Terhitung mulai tanggal bertugas. Inilah yang jadi masa kerja di rapor KPI.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employment_type">Jenis Kepegawaian</Label>
              <select
                id="employment_type"
                name="employment_type"
                defaultValue={profile.employment_type ?? ''}
                className={inputCls}
              >
                <option value="">— belum ditentukan —</option>
                {EMPLOYMENT.map(e => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}

      {/* ── Data diri ─────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Data Diri</h2>
        {scope === 'guru' && (
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Nama lengkap, NIP, unit, dan TMT dikelola SDM. Kalau ada yang keliru,
            sampaikan kepada SDM.
          </p>
        )}

        <div className="flex items-start gap-4">
          <PhotoAdjuster
            key={adjusterKey}
            name="photo_focus"
            src={photoPreview}
            initial={adjusterKey === 0 ? parseFocus(profile.photo_focus) : undefined}
            size={88}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="photo">Foto Profil</Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPhotoChange}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              JPG/PNG/WebP, maksimal 2 MB. Ketuk lingkarannya untuk mengatur posisi.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sapaan">Sapaan</Label>
            <select id="sapaan" name="sapaan" defaultValue={profile.sapaan ?? ''} className={inputCls}>
              <option value="">— tidak diisi —</option>
              <option value="ust">Ust.</option>
              <option value="usth">Usth.</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nickname">Nama Panggilan</Label>
            <Input id="nickname" name="nickname" defaultValue={profile.nickname ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_place">Tempat Lahir</Label>
            <Input id="birth_place" name="birth_place" defaultValue={profile.birth_place ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">Tanggal Lahir</Label>
            <Input id="birth_date" name="birth_date" type="date" defaultValue={profile.birth_date ?? ''} />
          </div>
        </div>
      </section>

      {/* ── Riwayat pendidikan ────────────────────────────────── */}
      <RowSection
        variant="card"
        title="Riwayat Pendidikan Formal"
        onAdd={() => setEducation([...education, newEducationRow()])}
      >
        {education.map((row, i) => (
          <RowShell key={row.uid} onRemove={() => setEducation(education.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_90px]">
              <select
                name="edu_level"
                value={row.level}
                onChange={e => patchEducation(i, { level: e.target.value })}
                className={inputCls}
                aria-label={`Jenjang ${i + 1}`}
              >
                <option value="">Jenjang</option>
                {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <Input
                name="edu_institution"
                value={row.institution}
                onChange={e => patchEducation(i, { institution: e.target.value })}
                placeholder={institutionPlaceholder(row.level)}
                aria-label={`Institusi ${i + 1}`}
              />
              <Input
                name="edu_major"
                value={row.major}
                onChange={e => patchEducation(i, { major: e.target.value })}
                placeholder={hasMajorField(row.level) ? 'Jurusan' : 'Jurusan (opsional)'}
                aria-label={`Jurusan ${i + 1}`}
              />
              <Input
                name="edu_year"
                value={row.graduation_year}
                onChange={e => patchEducation(i, { graduation_year: e.target.value })}
                placeholder="Lulus"
                inputMode="numeric"
                aria-label={`Tahun lulus ${i + 1}`}
              />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Kompetensi Al-Qur'an ──────────────────────────────── */}
      <RowSection
        variant="card"
        title="Kompetensi Al-Qur'an yang Dimiliki"
        desc="Isi lembaga penjaminnya bila sudah tersertifikasi; kosongkan bila belum."
        onAdd={() => setQuranComps([...quranComps, EMPTY_COMPETENCY])}
      >
        {quranComps.map((c, i) => (
          <RowShell key={i} onRemove={() => setQuranComps(quranComps.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="quran_comp_name" defaultValue={c.name} placeholder="Tahsin metode UMMI" aria-label={`Kompetensi Al-Qur'an ${i + 1}`} />
              <Input name="quran_comp_institution" defaultValue={c.institution} placeholder="Lembaga penjamin (kosongkan bila belum)" aria-label={`Lembaga penjamin ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Kompetensi lain ───────────────────────────────────── */}
      <RowSection
        variant="card"
        title="Kompetensi Lain yang Dimiliki"
        desc="Kompetensi di luar Al-Qur'an. Lembaga diisi hanya bila tersertifikasi."
        onAdd={() => setOtherComps([...otherComps, EMPTY_COMPETENCY])}
      >
        {otherComps.map((c, i) => (
          <RowShell key={i} onRemove={() => setOtherComps(otherComps.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="other_comp_name" defaultValue={c.name} placeholder="Kurikulum PHI" aria-label={`Kompetensi lain ${i + 1}`} />
              <Input name="other_comp_institution" defaultValue={c.institution} placeholder="Lembaga penjamin (kosongkan bila belum)" aria-label={`Lembaga penjamin lain ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Diklat ────────────────────────────────────────────── */}
      <RowSection
        variant="card"
        title="Diklat & Pelatihan yang Pernah Diikuti"
        onAdd={() => setTrainings([...trainings, EMPTY_TRAINING])}
      >
        {trainings.map((t, i) => (
          <RowShell key={i} onRemove={() => setTrainings(trainings.filter((_, x) => x !== i))}>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px_1fr]">
              <Input name="training_name" defaultValue={t.name} placeholder="Nama diklat" aria-label={`Nama diklat ${i + 1}`} />
              <Input name="training_year" defaultValue={t.year} placeholder="Tahun" aria-label={`Tahun diklat ${i + 1}`} />
              <Input name="training_organizer" defaultValue={t.organizer} placeholder="Penyelenggara" aria-label={`Penyelenggara ${i + 1}`} />
            </div>
          </RowShell>
        ))}
      </RowSection>

      {/* ── Riwayat amanah ────────────────────────────────────── */}
      <RowSection
        variant="card"
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
        variant="card"
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

      {/* ── Ijazah & sanad ────────────────────────────────────── */}
      <RowSection
        variant="card"
        title="Ijazah & Sanad yang Dimiliki"
        desc="Cukup nama ijazah atau sanadnya — tahun tidak perlu dicatat."
        onAdd={() => setIjazahSanad([...ijazahSanad, ''])}
      >
        {ijazahSanad.map((v, i) => (
          <RowShell key={i} onRemove={() => setIjazahSanad(ijazahSanad.filter((_, x) => x !== i))}>
            <Input
              name="ijazah_sanad"
              defaultValue={v}
              placeholder="Sanad Qira'ah Ashim riwayat Hafsh"
              aria-label={`Ijazah atau sanad ${i + 1}`}
            />
          </RowShell>
        ))}
      </RowSection>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.message}</p>}

      <div className="sticky bottom-0 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Profil'}
        </Button>
      </div>
    </form>
  )
}
