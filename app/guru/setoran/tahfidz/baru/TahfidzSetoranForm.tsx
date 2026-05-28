'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTahfidzLogAction } from '@/app/actions/setoran'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StarRating } from '@/components/StarRating'

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
  defaultStudentId?: string
}

export function TahfidzSetoranForm({ students, surat, defaultStudentId }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createTahfidzLogAction, null)

  const initialStudent = students.find(s => s.id === defaultStudentId) ?? null
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [kind, setKind] = useState<'hafalan_baru' | 'murojaah'>('hafalan_baru')
  const [suratId, setSuratId] = useState<string>('')
  const [ayatDari, setAyatDari] = useState('')
  const [ayatKe, setAyatKe] = useState('')

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

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      {/* Siswa */}
      <div className="space-y-1.5">
        <Label htmlFor="student_id">Siswa *</Label>
        {initialStudent ? (
          <>
            <input type="hidden" name="student_id" value={initialStudent.id} />
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
          </>
        ) : (
          <Select name="student_id" value={studentId} onValueChange={setStudentId} required>
            <SelectTrigger id="student_id"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
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

      {/* Jenis */}
      <div className="space-y-1.5">
        <Label>Jenis Setoran</Label>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setKind('hafalan_baru')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={kind === 'hafalan_baru'
              ? { borderColor: '#b8860b', background: '#fdf6e3' }
              : { borderColor: '#e7e3da', background: 'white' }}
          >
            <p className="font-medium text-sm">✨ Hafalan Baru</p>
            <p className="text-xs text-muted-foreground">Tambah hafalan, hitung ke progress juz</p>
          </button>
          <button
            type="button"
            onClick={() => setKind('murojaah')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={kind === 'murojaah'
              ? { borderColor: '#1d4ed8', background: '#dbeafe' }
              : { borderColor: '#e7e3da', background: 'white' }}
          >
            <p className="font-medium text-sm">🔁 Muroja&apos;ah</p>
            <p className="text-xs text-muted-foreground">Mengulang, tidak menambah progress</p>
          </button>
        </div>
      </div>

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
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: '#fdf6e3', color: '#8a6308' }}>
            {ayatCount} ayat disetor
            {kind === 'hafalan_baru' && selectedSurat && ` · ditambahkan ke progress Juz ${selectedSurat.juz_start}`}
          </div>
        )}
      </fieldset>

      {/* Penilaian */}
      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold mb-3">Penilaian</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 rounded-lg p-4">
          <div>
            <p className="text-xs font-medium mb-1.5">Makhraj</p>
            <StarRating name="nilai_makhraj" />
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

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 border-t pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="catatan">Catatan Guru</Label>
          <Textarea id="catatan" name="catatan" rows={2} placeholder="contoh: lancar, perlu perbaikan waqaf..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal Setor</Label>
          <Input id="setoran_date" name="setoran_date" type="date" defaultValue={today} disabled={isPending} />
        </div>
      </div>

      {/* Naik juz (hanya hafalan baru) */}
      {kind === 'hafalan_baru' && (
        <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer" style={{ background: '#fdf6e3', borderColor: '#f0e0a8' }}>
          <input type="checkbox" name="naik_juz" className="mt-0.5" style={{ accentColor: '#b8860b' }} disabled={isPending} />
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
        <Button type="submit" disabled={isPending || !studentId || ayatOutOfRange} style={{ background: '#b8860b', borderColor: '#b8860b' }}>
          {isPending ? 'Menyimpan...' : 'Simpan Setoran'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}
