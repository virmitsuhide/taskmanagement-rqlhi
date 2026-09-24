'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { catatUjianAlumniSdAction } from '@/app/actions/ujian'
import { PREDIKAT_OPTIONS, getPredikatLabel, getStatusLabel, getTahfidzLabel } from '@/lib/rq/ujian'
import { ringkasHafalan } from '@/lib/rq/hafalan'
import { cn } from '@/lib/utils'
import type { UjianAlumniSd } from '@/lib/data/ujian'
import type { TahfidzTipe, UjianPredikat } from '@/types'

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

interface Bawaan {
  tanggal: string
  penguji: string
}

/**
 * Daftar alumni SD LHI di SMP, masing-masing dengan pintu pencatatan ujian SD.
 *
 * Isian bawaan (tanggal & penguji) diisi sekali di atas: ujian satu angkatan
 * kelas 6 biasanya berlangsung di pekan yang sama dengan penguji yang sama,
 * dan mengetik ulang keduanya dua puluh lima kali adalah cara paling cepat
 * membuat orang berhenti mencatat.
 */
export function UjianAlumniSd({ siswa }: { siswa: UjianAlumniSd[] }) {
  const [filter, setFilter] = useState<'semua' | 'belum'>('semua')
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const [bawaan, setBawaan] = useState<Bawaan>({ tanggal: '', penguji: '' })

  const belum = siswa.filter(s => s.juzTeruji === 0)
  const tampil = filter === 'belum' ? belum : siswa
  const perKelas = useMemo(() => {
    const peta = new Map<string, UjianAlumniSd[]>()
    for (const s of tampil) peta.set(s.kelas ?? 'Tanpa kelas', [...(peta.get(s.kelas ?? 'Tanpa kelas') ?? []), s])
    return [...peta]
  }, [tampil])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs font-medium mb-2">Isian bawaan untuk setiap catatan baru</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bawaan_tanggal" className="text-xs">Tanggal ujian</Label>
            <Input id="bawaan_tanggal" type="date" max={new Date().toISOString().slice(0, 10)} value={bawaan.tanggal}
              onChange={e => setBawaan(b => ({ ...b, tanggal: e.target.value }))} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bawaan_penguji" className="text-xs">Penguji</Label>
            <Input id="bawaan_penguji" value={bawaan.penguji} placeholder="Nama penguji (opsional)"
              onChange={e => setBawaan(b => ({ ...b, penguji: e.target.value }))} className="h-9" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tanggal perkiraan boleh bila tanggal pastinya tidak tercatat — mis. pekan ujian akhir kelas 6.
        </p>
      </div>

      <div className="flex gap-1.5">
        {([['semua', `Semua · ${siswa.length}`], ['belum', `Belum ada ujian · ${belum.length}`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border',
            )}>
            {label}
          </button>
        ))}
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Semua alumni sudah punya catatan ujian.</p>
      ) : perKelas.map(([kelas, anggota]) => (
        <section key={kelas} className="rounded-2xl border bg-card">
          <h2 className="font-heading text-lg font-medium border-b px-4 py-2.5">Kelas {kelas} <span className="font-normal text-muted-foreground">· {anggota.length} siswa</span></h2>
          <ul className="divide-y">
            {anggota.map(s => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.nama}</p>
                    <p className="text-[11px] text-muted-foreground">{s.halaqoh ?? 'Tanpa halaqoh'}</p>
                    <p className="mt-1 text-xs">
                      {s.juzTeruji > 0
                        ? <span style={{ color: 'var(--success)' }}>Juz teruji: {ringkasHafalan(s.juzTeruji)}</span>
                        : <span style={{ color: 'var(--warning)' }}>Belum ada ujian lulus tercatat</span>}
                    </p>
                    {s.ujian.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {s.ujian.map(u => (
                          <li key={u.id} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {getTahfidzLabel(u.tipe, u.juz)}
                            {' · '}{u.status === 'selesai' ? getPredikatLabel(u.predikat) : getStatusLabel(u.status)}
                            {u.tanggal && ` · ${u.tanggal}`} · {u.unit}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {terbuka !== s.id && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setTerbuka(s.id)} className="shrink-0">
                      <Plus className="mr-1 h-3.5 w-3.5" />Catat ujian
                    </Button>
                  )}
                </div>
                {terbuka === s.id && (
                  <FormUjian siswa={s} bawaan={bawaan} onTutup={() => setTerbuka(null)} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function FormUjian({ siswa, bawaan, onTutup }: { siswa: UjianAlumniSd; bawaan: Bawaan; onTutup: () => void }) {
  const router = useRouter()
  const [tipe, setTipe] = useState<TahfidzTipe>('1_juz')
  // Juz 30 hampir selalu yang pertama diujikan di SD; anak yang sudah punya
  // catatan dibiarkan kosong supaya juz berikutnya dipilih dengan sadar.
  const [juzDari, setJuzDari] = useState(siswa.juzTeruji === 0 ? '30' : '')
  const [juzSampai, setJuzSampai] = useState('')
  const [tanggal, setTanggal] = useState(bawaan.tanggal)
  const [penguji, setPenguji] = useState(bawaan.penguji)
  const [predikat, setPredikat] = useState<UjianPredikat | ''>('')
  const [kelas, setKelas] = useState('6')
  const [quls, setQuls] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [pending, startTransition] = useTransition()

  const cakupan = tipe === '3_juz' ? 3 : tipe === '5_juz' ? 5 : 1
  const pratinjau = juzDari
    ? tipe === '1_juz' ? juzDari : juzSampai ? `${Math.min(+juzDari, +juzSampai)}-${Math.max(+juzDari, +juzSampai)}` : ''
    : ''

  function simpan(e: React.FormEvent) {
    e.preventDefault()
    if (!predikat) {
      toast.error('Predikat wajib dipilih.')
      return
    }
    startTransition(async () => {
      const hasil = await catatUjianAlumniSdAction({
        student_id: siswa.id, tipe, juz_dari: Number(juzDari), juz_sampai: tipe === '1_juz' ? null : Number(juzSampai),
        tanggal, penguji, predikat, catatan, kelas_saat_ujian: kelas, is_quls: quls,
      })
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(`Tercatat: ${siswa.nama.split(' ')[0]} — ${getTahfidzLabel(tipe, pratinjau)}`)
      onTutup()
      router.refresh()
    })
  }

  return (
    <form onSubmit={simpan} className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Ujian semasa di SD LHI</p>
        <button type="button" onClick={onTutup} aria-label="Tutup" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Jenis</Label>
          <select value={tipe} onChange={e => { setTipe(e.target.value as TahfidzTipe); setJuzSampai('') }} className={SELECT_CLASS}>
            <option value="1_juz">Tasmi&apos; 1 Juz</option>
            <option value="3_juz">Tasmi&apos; 3 Juz</option>
            <option value="5_juz">Tasmi&apos; 5 Juz</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tipe === '1_juz' ? 'Nomor juz' : `Rentang ${cakupan} juz`}</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={30} required value={juzDari} onChange={e => setJuzDari(e.target.value)}
              placeholder={tipe === '1_juz' ? '30' : 'dari'} className="h-9" />
            {tipe !== '1_juz' && (
              <>
                <span className="text-muted-foreground">–</span>
                <Input aria-label="Sampai juz" type="number" min={1} max={30} required value={juzSampai}
                  onChange={e => setJuzSampai(e.target.value)} placeholder="sampai" className="h-9" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-xs">Tanggal ujian</Label>
          <Input type="date" required max={new Date().toISOString().slice(0, 10)} value={tanggal}
            onChange={e => setTanggal(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label className="text-xs">Predikat</Label>
          <select required value={predikat} onChange={e => setPredikat(e.target.value as UjianPredikat)} className={SELECT_CLASS}>
            <option value="" disabled>Pilih…</option>
            {PREDIKAT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kelas saat ujian</Label>
          <Input value={kelas} onChange={e => setKelas(e.target.value)} className="h-9" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-xs">
          <input type="checkbox" checked={quls} onChange={e => setQuls(e.target.checked)} className="h-4 w-4" />
          QuLS saat SD
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Penguji (opsional)</Label>
          <Input value={penguji} onChange={e => setPenguji(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Catatan (opsional)</Label>
          <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Bawaan: Ujian semasa di SDIT LHI" className="h-9" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {pratinjau ? <>Akan tercatat: <strong className="text-foreground">{getTahfidzLabel(tipe, pratinjau)}</strong> · unit SD · selesai</> : 'Isi nomor juz.'}
        </p>
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </form>
  )
}
