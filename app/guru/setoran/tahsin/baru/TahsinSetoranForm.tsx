'use client'

import { useActionState, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTahsinLogAction } from '@/app/actions/setoran'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface StudentOption {
  id: string
  full_name: string
  halaqoh_name: string | null
  current_method_id: string | null
  current_jilid_id: string | null
  current_jilid_page: number | null
}
interface MethodOption { id: string; name: string }
interface JilidOption { id: string; label: string; method_id: string; order_num: number }

interface Props {
  students: StudentOption[]
  methods: MethodOption[]
  jilidLevels: JilidOption[]
  defaultStudentId?: string
}

const RATING_LABELS = ['', 'Kurang', 'Cukup', 'Baik', 'Bagus', 'Sangat Bagus']

function StarRating({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div>
      <input type="hidden" name={name} value={value || ''} />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n === value ? 0 : n)}
            className="w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors"
            style={n <= value
              ? { background: '#b8860b', borderColor: '#b8860b', color: 'white' }
              : { background: 'white', borderColor: '#e7e3da', color: '#6b6b6b' }}
            aria-label={`${n} bintang`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 h-3.5">{RATING_LABELS[value]}</p>
    </div>
  )
}

export function TahsinSetoranForm({ students, methods, jilidLevels, defaultStudentId }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createTahsinLogAction, null)

  const initialStudent = students.find(s => s.id === defaultStudentId) ?? null
  const [studentId, setStudentId] = useState(defaultStudentId ?? '')
  const [methodId, setMethodId] = useState(initialStudent?.current_method_id ?? '')
  const [status, setStatus] = useState<'lulus' | 'ulang'>('lulus')

  const selectedStudent = students.find(s => s.id === studentId) ?? null

  const jilidOptions = useMemo(
    () => jilidLevels.filter(j => j.method_id === methodId).sort((a, b) => a.order_num - b.order_num),
    [jilidLevels, methodId],
  )

  // Saat ganti siswa, sync metode & jilid ke posisi siswa
  function onStudentChange(id: string) {
    setStudentId(id)
    const s = students.find(x => x.id === id)
    if (s?.current_method_id) setMethodId(s.current_method_id)
  }

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
                onClick={() => router.push('/guru/setoran/tahsin/baru')}
                className="text-xs text-muted-foreground hover:underline"
              >
                Ganti
              </button>
            </div>
          </>
        ) : (
          <Select name="student_id" value={studentId} onValueChange={onStudentChange} required>
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

      {/* Materi */}
      <fieldset className="border-t pt-4 space-y-3">
        <legend className="text-sm font-semibold mb-1">Materi Setoran</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="method_id">Metode *</Label>
            <Select name="method_id" value={methodId} onValueChange={setMethodId} required>
              <SelectTrigger id="method_id"><SelectValue placeholder="Metode" /></SelectTrigger>
              <SelectContent>
                {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jilid_id">Jilid *</Label>
            <Select name="jilid_id" defaultValue={selectedStudent?.current_jilid_id ?? ''} disabled={!methodId} required>
              <SelectTrigger id="jilid_id"><SelectValue placeholder="Jilid" /></SelectTrigger>
              <SelectContent>
                {jilidOptions.map(j => <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="halaman">Halaman</Label>
            <Input
              id="halaman" name="halaman" type="number" min={1}
              defaultValue={selectedStudent?.current_jilid_page ?? ''}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="baris_dari">Baris dari</Label>
            <Input id="baris_dari" name="baris_dari" type="number" min={1} disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baris_ke">Baris ke</Label>
            <Input id="baris_ke" name="baris_ke" type="number" min={1} disabled={isPending} />
          </div>
        </div>
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

      {/* Status */}
      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold mb-3">Status Halaman</legend>
        <input type="hidden" name="status" value={status} />
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setStatus('lulus')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={status === 'lulus'
              ? { borderColor: '#15803d', background: '#dcfce7' }
              : { borderColor: '#e7e3da', background: 'white' }}
          >
            <p className="font-medium text-sm">✅ Lulus</p>
            <p className="text-xs text-muted-foreground">Lanjut halaman berikutnya</p>
          </button>
          <button
            type="button"
            onClick={() => setStatus('ulang')}
            className="rounded-lg border p-3 text-left transition-colors"
            style={status === 'ulang'
              ? { borderColor: '#a16207', background: '#fef9c3' }
              : { borderColor: '#e7e3da', background: 'white' }}
          >
            <p className="font-medium text-sm">🔁 Ulang</p>
            <p className="text-xs text-muted-foreground">Belum tuntas, mengulang</p>
          </button>
        </div>
      </fieldset>

      {/* Catatan + tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 border-t pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="catatan">Catatan Guru</Label>
          <Textarea id="catatan" name="catatan" rows={2} placeholder="contoh: perhatikan madd, latih sukun..." disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setoran_date">Tanggal Setor</Label>
          <Input id="setoran_date" name="setoran_date" type="date" defaultValue={today} disabled={isPending} />
        </div>
      </div>

      {/* Naik jilid (hanya saat lulus) */}
      {status === 'lulus' && (
        <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer" style={{ background: '#fdf6e3', borderColor: '#f0e0a8' }}>
          <input type="checkbox" name="naik_jilid" className="mt-0.5" style={{ accentColor: '#b8860b' }} disabled={isPending} />
          <div>
            <p className="font-medium text-sm">🎉 Naik jilid setelah setoran ini</p>
            <p className="text-xs text-muted-foreground">
              Centang jika siswa lulus ujian jilid ini & naik ke jilid berikutnya. Halaman akan di-reset ke 1.
            </p>
          </div>
        </label>
      )}

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending || !studentId} style={{ background: '#b8860b', borderColor: '#b8860b' }}>
          {isPending ? 'Menyimpan...' : 'Simpan Setoran'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Batal
        </Button>
      </div>
    </form>
  )
}
