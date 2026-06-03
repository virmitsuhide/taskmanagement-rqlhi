'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTahfidzLogAction, createTasmiLogAction } from '@/app/actions/setoran'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StarRating } from '@/components/StarRating'
import { TAHFIDZ_KIND_META, TASMI_SCOPES } from '@/lib/tahsin'
import type { TahfidzKind, TasmiScope } from '@/types'

interface StudentOption {
  id: string
  full_name: string
  halaqoh_name: string | null
}
interface SuratOption {
  id: number
  name_latin: string
  total_ayat: number
  juz_start: number
}

interface Props {
  students: StudentOption[]
  surat: SuratOption[]
  /** Juz yang sudah diujikan (dijuz'iyahkan) per siswa — untuk hint muroja'ah lama. */
  completedJuzByStudent?: Record<string, number[]>
  defaultStudentId?: string
}

const today = () => new Date().toISOString().slice(0, 10)

export function TahfidzSetoranForm({ students, surat, completedJuzByStudent = {}, defaultStudentId }: Props) {
  const router = useRouter()
  const initialStudent = students.find(s => s.id === defaultStudentId) ?? null
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [kind, setKind] = useState<TahfidzKind>('ziyadah')

  const completedJuz = completedJuzByStudent[studentId] ?? []

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Siswa */}
      <div className="space-y-1.5">
        <Label htmlFor="student_picker">Siswa *</Label>
        {initialStudent ? (
          <div className="rounded-lg border px-3 py-2.5 bg-muted/30 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{initialStudent.full_name}</p>
              <p className="text-xs text-muted-foreground">{initialStudent.halaqoh_name ?? '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/guru/setoran/tahfidz/baru')}
              className="text-xs text-muted-foreground hover:underline"
            >
              Ganti
            </button>
          </div>
        ) : (
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id="student_picker"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
            <SelectContent>
              {students.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}{s.halaqoh_name ? ` · ${s.halaqoh_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Jenis setoran */}
      <div className="space-y-1.5">
        <Label>Jenis Setoran</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['ziyadah', 'murojaah_baru', 'murojaah_lama', 'tasmi'] as TahfidzKind[]).map(k => {
            const meta = TAHFIDZ_KIND_META[k]
            const active = kind === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="rounded-lg border p-2.5 text-left transition-colors"
                style={active
                  ? { borderColor: meta.fg, background: meta.bg }
                  : { borderColor: 'var(--border)', background: 'white' }}
              >
                <p className="font-medium text-sm" style={active ? { color: meta.fg } : undefined}>
                  {meta.emoji} {meta.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{meta.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      {kind === 'tasmi' ? (
        <TasmiSubForm studentId={studentId} onCancel={() => router.back()} />
      ) : (
        <DailySubForm
          studentId={studentId}
          kind={kind}
          surat={surat}
          completedJuz={completedJuz}
          onCancel={() => router.back()}
        />
      )}
    </div>
  )
}

// ─── Setoran harian (ziyadah / muroja'ah baru / lama) ───────────────
function DailySubForm({
  studentId, kind, surat, completedJuz, onCancel,
}: {
  studentId: string
  kind: Exclude<TahfidzKind, 'tasmi'>
  surat: SuratOption[]
  completedJuz: number[]
  onCancel: () => void
}) {
  const [state, formAction, isPending] = useActionState(createTahfidzLogAction, null)
  const [suratId, setSuratId] = useState('')
  const [ayatDari, setAyatDari] = useState('')
  const [ayatKe, setAyatKe] = useState('')
  const meta = TAHFIDZ_KIND_META[kind]

  const selectedSurat = useMemo(
    () => surat.find(s => String(s.id) === suratId) ?? null,
    [surat, suratId],
  )
  const ayatCount =
    ayatDari && ayatKe && Number(ayatKe) >= Number(ayatDari)
      ? Number(ayatKe) - Number(ayatDari) + 1
      : 0
  const ayatOutOfRange =
    selectedSurat && ayatKe ? Number(ayatKe) > selectedSurat.total_ayat : false

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="kind" value={kind} />

      {kind === 'murojaah_lama' && (
        <div className="text-xs rounded-lg px-3 py-2 border" style={{ background: meta.bg, color: meta.fg, borderColor: meta.fg }}>
          {completedJuz.length > 0
            ? <>Juz yang sudah diujikan: {completedJuz.sort((a, b) => a - b).map(j => `Juz ${j}`).join(', ')}. Pilih surat dari salah satu juz tersebut.</>
            : <>Belum ada juz yang diujikan untuk siswa ini — biasanya muroja&apos;ah lama dipakai setelah ada juz yang lulus.</>}
        </div>
      )}

      {/* Surat + ayat */}
      <fieldset className="border-t pt-4 space-y-3">
        <legend className="text-sm font-semibold mb-1">Materi</legend>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="surat_id">Surat *</Label>
            <Select name="surat_id" value={suratId} onValueChange={setSuratId} required>
              <SelectTrigger id="surat_id"><SelectValue placeholder="Pilih surat" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {surat.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.id}. {s.name_latin} ({s.total_ayat} ayat)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Juz</Label>
            <div className="h-9 px-3 flex items-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
              {selectedSurat ? `Juz ${selectedSurat.juz_start}` : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="ayat_dari">Ayat dari *</Label>
            <Input
              id="ayat_dari" name="ayat_dari" type="number" min={1}
              max={selectedSurat?.total_ayat}
              value={ayatDari} onChange={e => setAyatDari(e.target.value)}
              required disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ayat_ke">Ayat ke *</Label>
            <Input
              id="ayat_ke" name="ayat_ke" type="number" min={1}
              max={selectedSurat?.total_ayat}
              value={ayatKe} onChange={e => setAyatKe(e.target.value)}
              required disabled={isPending}
            />
          </div>
        </div>

        {ayatOutOfRange && (
          <p className="text-xs text-destructive">
            Surat {selectedSurat?.name_latin} hanya punya {selectedSurat?.total_ayat} ayat.
          </p>
        )}
        {ayatCount > 0 && !ayatOutOfRange && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: meta.bg, color: meta.fg }}>
            {ayatCount} ayat disetor
            {meta.addsProgress && selectedSurat && ` · ditambahkan ke progress Juz ${selectedSurat.juz_start}`}
          </div>
        )}
      </fieldset>

      <ScoreFields />

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 border-t pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="catatan">Catatan Guru</Label>
          <Textarea id="catatan" name="catatan" rows={2} placeholder="contoh: lancar, perlu perbaikan waqaf..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal Setor</Label>
          <Input id="setoran_date" name="setoran_date" type="date" defaultValue={today()} disabled={isPending} />
        </div>
      </div>

      {/* Naik juz (hanya ziyadah) */}
      {kind === 'ziyadah' && (
        <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer" style={{ background: 'var(--primary-wash)', borderColor: 'var(--border)' }}>
          <input type="checkbox" name="naik_juz" className="mt-0.5" style={{ accentColor: 'var(--primary)' }} disabled={isPending} />
          <div>
            <p className="font-medium text-sm">
              🎉 Tandai {selectedSurat ? `Juz ${selectedSurat.juz_start}` : 'juz ini'} selesai (mutqin)
            </p>
            <p className="text-xs text-muted-foreground">
              Centang jika siswa khatam &amp; lulus ujian juz ini. Akan tercatat di riwayat kenaikan juz.
            </p>
          </div>
        </label>
      )}

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending || !studentId || ayatOutOfRange} style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }}>
          {isPending ? 'Menyimpan...' : 'Simpan Setoran'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}

// ─── Setoran tasmi' (3 / 5 juz) ─────────────────────────────────────
function TasmiSubForm({ studentId, onCancel }: { studentId: string; onCancel: () => void }) {
  const [state, formAction, isPending] = useActionState(createTasmiLogAction, null)
  const [scope, setScope] = useState<TasmiScope>(3)
  const [juzFrom, setJuzFrom] = useState('')
  const [status, setStatus] = useState<'lulus' | 'ulang'>('lulus')

  const from = juzFrom ? Number(juzFrom) : null
  const to = from !== null ? from + scope - 1 : null
  const rangeValid = from !== null && from >= 1 && to !== null && to <= 30

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="scope_juz" value={scope} />
      <input type="hidden" name="juz_to" value={to ?? ''} />
      <input type="hidden" name="status" value={status} />

      {/* Cakupan */}
      <fieldset className="border-t pt-4 space-y-3">
        <legend className="text-sm font-semibold mb-1">Cakupan Tasmi&apos;</legend>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          {TASMI_SCOPES.map(sc => (
            <button
              key={sc}
              type="button"
              onClick={() => setScope(sc)}
              className="rounded-lg border p-3 text-center transition-colors"
              style={scope === sc
                ? { borderColor: '#b45309', background: '#fef3c7', color: '#b45309' }
                : { borderColor: 'var(--border)', background: 'white' }}
            >
              <p className="font-semibold text-sm">{sc} Juz</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="juz_from">Mulai Juz *</Label>
            <Input
              id="juz_from" name="juz_from" type="number" min={1} max={30}
              value={juzFrom} onChange={e => setJuzFrom(e.target.value)}
              required disabled={isPending} placeholder="1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sampai Juz</Label>
            <div className="h-9 px-3 flex items-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
              {to !== null ? `Juz ${to}` : '—'}
            </div>
          </div>
        </div>
        {from !== null && !rangeValid && (
          <p className="text-xs text-destructive">Rentang juz di luar 1–30. Periksa juz mulai.</p>
        )}
        {rangeValid && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#fef3c7', color: '#b45309' }}>
            Tasmi&apos; {scope} juz: Juz {from} – {to}
          </div>
        )}
      </fieldset>

      <ScoreFields />

      {/* Status */}
      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold mb-3">Hasil</legend>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setStatus('lulus')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={status === 'lulus' ? { borderColor: '#15803d', background: '#dcfce7' } : { borderColor: 'var(--border)', background: 'white' }}
          >
            <p className="font-medium text-sm">✅ Lulus</p>
            <p className="text-xs text-muted-foreground">Tasmi&apos; tuntas</p>
          </button>
          <button
            type="button"
            onClick={() => setStatus('ulang')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={status === 'ulang' ? { borderColor: '#a16207', background: '#fef9c3' } : { borderColor: 'var(--border)', background: 'white' }}
          >
            <p className="font-medium text-sm">🔁 Ulang</p>
            <p className="text-xs text-muted-foreground">Perlu diulang</p>
          </button>
        </div>
      </fieldset>

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 border-t pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="catatan_tasmi">Catatan Guru</Label>
          <Textarea id="catatan_tasmi" name="catatan" rows={2} placeholder="contoh: lancar, beberapa ayat perlu diperbaiki..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date_tasmi">Tanggal Setor</Label>
          <Input id="setoran_date_tasmi" name="setoran_date" type="date" defaultValue={today()} disabled={isPending} />
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending || !studentId || !rangeValid} style={{ background: '#b45309', borderColor: '#b45309' }}>
          {isPending ? 'Menyimpan...' : "Simpan Tasmi'"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}

// ─── Penilaian (dipakai bersama) ────────────────────────────────────
function ScoreFields() {
  return (
    <fieldset className="border-t pt-4">
      <legend className="text-sm font-semibold mb-3">Penilaian</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 rounded-lg p-4">
        <div>
          <p className="text-xs font-medium mb-1.5">Fashohah</p>
          <StarRating name="nilai_fashohah" />
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5">Tajwid</p>
          <StarRating name="nilai_tajwid" />
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5">Kelancaran</p>
          <StarRating name="nilai_kelancaran" />
        </div>
      </div>
    </fieldset>
  )
}
