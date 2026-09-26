'use client'

import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simpanJenisEkstraAction, simpanSlotEkstraAction } from '@/app/actions/ekstra'
import type { JenisEkstra, SlotEkstra } from '@/lib/data/ekstra'

function Kolom({ label, children, lebar }: { label: string; children: React.ReactNode; lebar?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${lebar ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </label>
  )
}

const pilih = 'h-9 rounded-md border bg-background px-2 text-sm'

function useHasil(state: { error?: string; success?: true } | null, onOk?: () => void) {
  const awal = useRef(true)
  useEffect(() => {
    if (awal.current) { awal.current = false; return }
    if (state?.error) toast.error(state.error)
    else if (state?.success) { toast.success('Tersimpan.'); onOk?.() }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Tambah / ubah jenis ekstra — nama, bidang, biaya, jumlah peserta, waktu. */
export function FormJenisEkstra({ jenis, onSelesai }: { jenis?: JenisEkstra; onSelesai?: () => void }) {
  const [state, aksi, pending] = useActionState(simpanJenisEkstraAction, null)
  const form = useRef<HTMLFormElement>(null)
  useHasil(state, () => { if (!jenis) form.current?.reset(); onSelesai?.() })
  return (
    <form ref={form} action={aksi} className="grid gap-3 sm:grid-cols-2">
      {jenis && <input type="hidden" name="id" value={jenis.id} />}
      <Kolom label="Nama ekstra" lebar><Input name="nama" required defaultValue={jenis?.nama} placeholder="mis. Ekstra Tahsin Privat" /></Kolom>
      <Kolom label="Bidang">
        <select name="bidang" defaultValue={jenis?.bidang ?? 'tahsin'} className={pilih}>
          <option value="tahsin">Tahsin</option><option value="tahfidz">Tahfidz</option><option value="campuran">Tahsin &amp; tahfidz</option>
        </select>
      </Kolom>
      <Kolom label="Jumlah peserta per slot"><Input name="kuota" type="number" min={1} max={50} required defaultValue={jenis?.kuota ?? 1} /></Kolom>
      <Kolom label="Biaya (Rp, 0 = tanpa biaya)"><Input name="biaya" inputMode="numeric" defaultValue={jenis?.biaya ?? 0} /></Kolom>
      <Kolom label="Satuan biaya"><Input name="satuan_biaya" defaultValue={jenis?.satuan_biaya ?? 'per bulan'} /></Kolom>
      <Kolom label="Durasi tiap pertemuan (menit)"><Input name="durasi_menit" type="number" min={10} max={300} defaultValue={jenis?.durasi_menit ?? 60} /></Kolom>
      <Kolom label="Keterangan waktu"><Input name="keterangan_waktu" defaultValue={jenis?.keterangan_waktu} placeholder="mis. 2x sepekan" /></Kolom>
      <Kolom label="Deskripsi untuk orang tua" lebar>
        <textarea name="deskripsi" rows={2} defaultValue={jenis?.deskripsi} className="rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Untuk siapa ekstra ini, apa yang dipelajari, dan catatan kafalah bila ada." />
      </Kolom>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="aktif" defaultChecked={jenis?.aktif ?? true} className="h-4 w-4" />Dibuka untuk pendaftaran</label>
      <div className="flex justify-end sm:col-span-1"><Button type="submit" disabled={pending}>{pending ? 'Menyimpan…' : jenis ? 'Simpan perubahan' : 'Tambah jenis'}</Button></div>
    </form>
  )
}

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad']

/** Buka / ubah slot pekanan: jenis + guru + hari + jam. */
export function FormSlotEkstra({ slot, jenis, guru, onSelesai }: {
  slot?: SlotEkstra
  jenis: JenisEkstra[]
  guru: { id: string; full_name: string }[]
  onSelesai?: () => void
}) {
  const [state, aksi, pending] = useActionState(simpanSlotEkstraAction, null)
  const form = useRef<HTMLFormElement>(null)
  useHasil(state, () => { if (!slot) form.current?.reset(); onSelesai?.() })
  return (
    <form ref={form} action={aksi} className="grid gap-3 sm:grid-cols-2">
      {slot && <input type="hidden" name="id" value={slot.id} />}
      <Kolom label="Jenis ekstra">
        <select name="jenis_id" required defaultValue={slot?.jenis_id ?? ''} className={pilih}>
          <option value="" disabled>Pilih jenis</option>
          {jenis.map(j => <option key={j.id} value={j.id}>{j.nama}{j.aktif ? '' : ' (ditutup)'}</option>)}
        </select>
      </Kolom>
      <Kolom label="Guru">
        <select name="teacher_id" required defaultValue={slot?.teacher_id ?? ''} className={pilih}>
          <option value="" disabled>Pilih guru</option>
          {guru.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
        </select>
      </Kolom>
      <Kolom label="Hari">
        <select name="hari" defaultValue={slot?.hari ?? 1} className={pilih}>
          {HARI.map((h, i) => <option key={h} value={i + 1}>{h}</option>)}
        </select>
      </Kolom>
      <div className="grid grid-cols-2 gap-2">
        <Kolom label="Mulai"><Input name="jam_mulai" type="time" required defaultValue={slot?.jam_mulai.slice(0, 5)} /></Kolom>
        <Kolom label="Selesai"><Input name="jam_selesai" type="time" required defaultValue={slot?.jam_selesai.slice(0, 5)} /></Kolom>
      </div>
      <Kolom label="Tempat"><Input name="tempat" defaultValue={slot?.tempat} placeholder="mis. Ruang RQ lt. 2" /></Kolom>
      <Kolom label="Kuota (kosong = ikut jenis)"><Input name="kuota" type="number" min={1} max={50} defaultValue={slot?.kuota ?? ''} /></Kolom>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="aktif" defaultChecked={slot?.aktif ?? true} className="h-4 w-4" />Slot dibuka</label>
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? 'Menyimpan…' : slot ? 'Simpan perubahan' : 'Buka slot'}</Button></div>
    </form>
  )
}
