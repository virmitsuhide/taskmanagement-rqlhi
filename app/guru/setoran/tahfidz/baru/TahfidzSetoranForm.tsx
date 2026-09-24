'use client'

import { useActionState, useMemo, useState } from 'react'
import { labelJuzRentang } from '@/lib/rq/batas-juz'
import { useRouter } from 'next/navigation'
import { createTahfidzLogAction } from '@/app/actions/setoran'
import { PerbandinganSetoranDialog } from '@/components/setoran/PerbandinganSetoranDialog'
import { useSetoranTimpa } from '@/components/setoran/useSetoranTimpa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StarInput } from '@/components/setoran/StarInput'
import { TAHFIDZ_KIND_META } from '@/lib/tahsin'
import { bolehLintasSurat, jumlahAyatRentang, periksaRentang } from '@/lib/rq/rentang-surat'
import type { TahfidzKind } from '@/types'

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
  /** Juz teruji per siswa (dari ujian yang selesai) — untuk hint muroja'ah lama. */
  completedJuzByStudent?: Record<string, number[]>
  defaultStudentId?: string
}

const today = () => new Date().toISOString().slice(0, 10)

export function TahfidzSetoranForm({ students, surat, completedJuzByStudent = {}, defaultStudentId }: Props) {
  const router = useRouter()
  const initialStudent = students.find(s => s.id === defaultStudentId) ?? null
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [kind, setKind] = useState<Exclude<TahfidzKind, 'tasmi'>>('ziyadah')

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(['ziyadah', 'murojaah_baru', 'murojaah_lama'] as const).map(k => {
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
                  : { borderColor: 'var(--border)', background: 'var(--card)' }}
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

      {/* Tasmi' 3 & 5 juz tidak lagi dicatat di sini — kini jenis ujian di
          Pengajuan Ujian, supaya satu tasmi' tidak tercatat di dua tempat. */}
      <DailySubForm
        studentId={studentId}
        kind={kind}
        surat={surat}
        completedJuz={completedJuz}
        onCancel={() => router.back()}
      />
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
  const kirim = useSetoranTimpa(formAction, state?.ganda)
  const [suratId, setSuratId] = useState('')
  const [ayatDari, setAyatDari] = useState('')
  // 'sama' = berakhir di surat yang sama. Radix Select tidak menerima nilai kosong.
  const [suratKe, setSuratKe] = useState('sama')
  const [ayatKe, setAyatKe] = useState('')
  const meta = TAHFIDZ_KIND_META[kind]
  const lintas = bolehLintasSurat(kind)

  const perId = useMemo(() => new Map(surat.map(s => [s.id, s])), [surat])
  const selectedSurat = perId.get(Number(suratId)) ?? null
  // Pindah ke ziyadah membuang pilihan surat akhir tanpa menghapusnya dari
  // isian — kembali ke muroja'ah, pilihannya masih ada.
  const suratKeId = lintas && suratKe !== 'sama' && Number(suratKe) !== Number(suratId) ? Number(suratKe) : null
  const suratAkhir = suratKeId ? perId.get(suratKeId) ?? null : selectedSurat

  const rentang = selectedSurat && ayatDari && ayatKe
    ? { surat_id: selectedSurat.id, ayat_dari: Number(ayatDari), surat_ke_id: suratKeId, ayat_ke: Number(ayatKe) }
    : null
  const galatRentang = rentang ? periksaRentang(rentang, id => perId.get(id)) : null
  const ayatCount = rentang && !galatRentang
    ? jumlahAyatRentang(rentang, id => perId.get(id)?.total_ayat ?? 0)
    : 0
  const ayatOutOfRange = Boolean(galatRentang)

  const pilihanSurat = surat.map(s => (
    <SelectItem key={s.id} value={String(s.id)}>
      {s.id}. {s.name_latin} ({s.total_ayat} ayat)
    </SelectItem>
  ))

  return (
    <form onSubmit={kirim.onSubmit} className="space-y-5">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="kind" value={kind} />

      {kind === 'murojaah_lama' && (
        <div className="text-xs rounded-lg px-3 py-2 border" style={{ background: meta.bg, color: meta.fg, borderColor: meta.fg }}>
          {completedJuz.length > 0
            ? <>Juz teruji: {completedJuz.sort((a, b) => a - b).map(j => `Juz ${j}`).join(', ')}. Pilih surat dari salah satu juz tersebut.</>
            : <>Belum ada juz teruji untuk siswa ini — muroja&apos;ah lama biasanya dipakai setelah ada juz yang lulus ujian.</>}
        </div>
      )}

      {/* Surat + ayat */}
      <fieldset className="rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both space-y-3">
        <legend className="font-heading text-lg font-medium mb-3">Materi</legend>
        <input type="hidden" name="surat_ke_id" value={suratKeId ?? ''} />

        {lintas ? (
          <>
            {/* Muroja'ah: "dari surat … ayat … sampai surat … ayat …". */}
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="surat_id">Dari surat *</Label>
                <Select name="surat_id" value={suratId} onValueChange={setSuratId} required>
                  <SelectTrigger id="surat_id"><SelectValue placeholder="Pilih surat" /></SelectTrigger>
                  <SelectContent className="max-h-72">{pilihanSurat}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ayat_dari">Ayat *</Label>
                <Input
                  id="ayat_dari" name="ayat_dari" type="number" min={1}
                  max={selectedSurat?.total_ayat}
                  value={ayatDari} onChange={e => setAyatDari(e.target.value)}
                  required disabled={isPending}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="surat_ke">Sampai surat</Label>
                <Select value={suratKe} onValueChange={setSuratKe}>
                  <SelectTrigger id="surat_ke"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="sama">
                      {selectedSurat ? `Surat yang sama (${selectedSurat.name_latin})` : 'Surat yang sama'}
                    </SelectItem>
                    {pilihanSurat}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ayat_ke">Ayat *</Label>
                <Input
                  id="ayat_ke" name="ayat_ke" type="number" min={1}
                  max={suratAkhir?.total_ayat}
                  value={ayatKe} onChange={e => setAyatKe(e.target.value)}
                  required disabled={isPending}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="surat_id">Surat *</Label>
                <Select name="surat_id" value={suratId} onValueChange={setSuratId} required>
                  <SelectTrigger id="surat_id"><SelectValue placeholder="Pilih surat" /></SelectTrigger>
                  <SelectContent className="max-h-72">{pilihanSurat}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Juz</Label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
                  {/* Juz menurut AYAT, bukan awal surat: Al-Baqarah 187 = juz 2. */}
                  {selectedSurat
                    ? (ayatDari && labelJuzRentang(selectedSurat.id, Number(ayatDari), ayatKe ? Number(ayatKe) : null)) || `Juz ${selectedSurat.juz_start}`
                    : '—'}
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
          </>
        )}

        {galatRentang && <p className="text-xs text-destructive">{galatRentang}</p>}
        {ayatCount > 0 && !ayatOutOfRange && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: meta.bg, color: meta.fg }}>
            {ayatCount} ayat disetor
            {suratKeId && selectedSurat && suratAkhir && ` · ${selectedSurat.name_latin} – ${suratAkhir.name_latin}`}
            {meta.addsProgress && selectedSurat && ` · ditambahkan ke progress ${labelJuzRentang(selectedSurat.id, Number(ayatDari), Number(ayatKe)) ?? `Juz ${selectedSurat.juz_start}`}`}
          </div>
        )}
      </fieldset>

      <ScoreFields />

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 rounded-2xl border bg-card p-4 md:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="catatan">Catatan Guru</Label>
          <Textarea id="catatan" name="catatan" rows={2} placeholder="contoh: lancar, perlu perbaikan waqaf..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal Setor</Label>
          <Input id="setoran_date" name="setoran_date" type="date" defaultValue={today()} disabled={isPending} />
        </div>
      </div>

      <PerbandinganSetoranDialog
        daftar={kirim.daftarGanda}
        pending={isPending}
        onTimpa={kirim.timpa}
        onBatal={kirim.batal}
      />

      {state?.error && (
        <p className="text-sm font-medium text-destructive bg-destructive-wash px-4 py-3 rounded-xl">{state.error}</p>
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

// ─── Penilaian (dipakai bersama) ────────────────────────────────────
function ScoreFields() {
  return (
    <fieldset className="rounded-2xl border bg-card p-4 md:p-5 [&>legend]:float-left [&>legend]:w-full [&>legend+*]:clear-both">
      <legend className="font-heading text-lg font-medium mb-3">Penilaian</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
        <div>
          <p className="text-xs font-medium mb-1.5">Nilai Tahfidz</p>
          <StarInput name="nilai_tahfidz" />
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5">Nilai Sikap</p>
          <StarInput name="nilai_sikap" />
        </div>
      </div>
    </fieldset>
  )
}
