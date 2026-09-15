'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PilihSiswa } from './PilihSiswa'
import { PREDIKAT_OPTIONS, getTahfidzLabel } from '@/lib/rq/ujian'
import { ringkasHafalan } from '@/lib/rq/hafalan'
import { catatRiwayatTahfidzAction, type SaranSiswa } from '@/app/actions/ujian'
import type { TahfidzTipe, UjianPredikat, UjianUnit } from '@/types'

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Formulir koordinator untuk tasmi' / juz'iyyah yang terjadi sebelum sistem.
 *
 * Setelah tersimpan, siswanya tetap terpilih: riwayat lama biasanya dimasukkan
 * beberapa baris sekaligus untuk anak yang sama (juz 30, lalu 29, lalu tasmi'
 * 5 juz), dan memilih ulang namanya tiap kali melelahkan.
 */
export function FormRiwayatTahfidz({ units }: { units: UjianUnit[] }) {
  const [unit, setUnit] = useState<UjianUnit>(units[0] ?? 'SD')
  const [siswa, setSiswa] = useState<SaranSiswa | null>(null)
  const [tipe, setTipe] = useState<TahfidzTipe>('5_juz')
  const [juzDari, setJuzDari] = useState('')
  const [juzSampai, setJuzSampai] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [penguji, setPenguji] = useState('')
  const [predikat, setPredikat] = useState<UjianPredikat | ''>('')
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const [tersimpan, setTersimpan] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const cakupan = tipe === '3_juz' ? 3 : tipe === '5_juz' ? 5 : 1
  const pratinjau = juzDari
    ? tipe === '1_juz' ? juzDari : juzSampai ? `${Math.min(+juzDari, +juzSampai)}-${Math.max(+juzDari, +juzSampai)}` : ''
    : ''

  function simpan(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!siswa) return setError('Pilih siswa lebih dulu.')
    if (!predikat) return setError('Predikat wajib dipilih.')

    startTransition(async () => {
      const hasil = await catatRiwayatTahfidzAction({
        unit,
        student_id: siswa.id,
        tipe,
        juz_dari: Number(juzDari),
        juz_sampai: tipe === '1_juz' ? null : Number(juzSampai),
        tanggal,
        penguji,
        predikat,
        catatan,
      })
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      const label = `${siswa.full_name.split(' ')[0]} — ${getTahfidzLabel(tipe, pratinjau)}`
      setTersimpan(prev => [label, ...prev])
      toast.success(`Tercatat: ${label}`)
      setJuzDari('')
      setJuzSampai('')
      setPredikat('')
      setCatatan('')
    })
  }

  return (
    <form onSubmit={simpan} className="space-y-4 rounded-xl border bg-card p-4">
      {units.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="unit_riwayat">Unit</Label>
          <select
            id="unit_riwayat" value={unit}
            onChange={e => { setUnit(e.target.value as UjianUnit); setSiswa(null) }}
            className={SELECT_CLASS}
          >
            {units.map(u => <option key={u} value={u}>{u === 'SD' ? 'SDIT LHI' : 'SMPIT LHI'}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Siswa</Label>
        <PilihSiswa key={unit} unit={unit} terpilih={siswa} onPilih={setSiswa} />
        {siswa && (
          <p className="text-xs text-muted-foreground">Tercatat sekarang: {ringkasHafalan(siswa.sudahSampai)}.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tipe_riwayat">Jenis</Label>
          <select
            id="tipe_riwayat" value={tipe}
            onChange={e => { setTipe(e.target.value as TahfidzTipe); setJuzSampai('') }}
            className={SELECT_CLASS}
          >
            <option value="1_juz">Tasmi&apos; 1 Juz (juz&apos;iyyah)</option>
            <option value="3_juz">Tasmi&apos; 3 Juz</option>
            <option value="5_juz">Tasmi&apos; 5 Juz</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="juz_dari">{tipe === '1_juz' ? 'Nomor juz' : `Rentang ${cakupan} juz`}</Label>
          <div className="flex items-center gap-2">
            <Input id="juz_dari" type="number" min={1} max={30} required placeholder={tipe === '1_juz' ? '30' : 'dari'}
              value={juzDari} onChange={e => setJuzDari(e.target.value)} className="h-9" />
            {tipe !== '1_juz' && (
              <>
                <span className="text-muted-foreground">–</span>
                <Input aria-label="Sampai juz" type="number" min={1} max={30} required placeholder="sampai"
                  value={juzSampai} onChange={e => setJuzSampai(e.target.value)} className="h-9" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tanggal_riwayat">Tanggal ujian</Label>
          <Input id="tanggal_riwayat" type="date" required value={tanggal}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setTanggal(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="predikat_riwayat">Predikat</Label>
          <select id="predikat_riwayat" required value={predikat}
            onChange={e => setPredikat(e.target.value as UjianPredikat)} className={SELECT_CLASS}>
            <option value="" disabled>Pilih…</option>
            {PREDIKAT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="penguji_riwayat">Penguji (opsional)</Label>
          <Input id="penguji_riwayat" value={penguji} onChange={e => setPenguji(e.target.value)}
            placeholder="Nama penguji" className="h-9" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catatan_riwayat">Catatan (opsional)</Label>
        <Input id="catatan_riwayat" value={catatan} onChange={e => setCatatan(e.target.value)}
          placeholder="mis. sumber: buku rekap tasmi' 2024" className="h-9" />
      </div>

      {pratinjau && (
        <p className="rounded-lg bg-info-wash px-3 py-2 text-sm text-info">
          Akan tercatat: {getTahfidzLabel(tipe, pratinjau)} · status Selesai
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !siswa}>
        {pending ? 'Menyimpan…' : siswa ? 'Catat riwayat' : 'Pilih siswa lebih dulu'}
      </Button>

      {tersimpan.length > 0 && (
        <div className="border-t pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Tercatat di sesi ini</p>
          <ul className="space-y-0.5 text-xs">
            {tersimpan.map((t, i) => <li key={i}>✓ {t}</li>)}
          </ul>
        </div>
      )}
    </form>
  )
}
