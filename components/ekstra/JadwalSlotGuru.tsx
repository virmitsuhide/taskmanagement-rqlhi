'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ubahJadwalEkstraGuruAction } from '@/app/actions/ekstra'
import { HARI_EKSTRA } from '@/lib/data/ekstra'

/**
 * Baris jadwal halaqoh ekstra di portal guru + tombol "Ubah jadwal": pengampu
 * mengatur sendiri hari, jam, dan tempat (lihat ubahJadwalEkstraGuruAction).
 */
export function JadwalSlotGuru({ slotId, label, hari, jamMulai, jamSelesai, tempat, jumlahPeserta }: {
  slotId: string
  /** "Senin 15.30–16.30" */
  label: string
  hari: number
  jamMulai: string
  jamSelesai: string
  tempat: string
  jumlahPeserta: number
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [buka, setBuka] = useState(false)
  const [h, setH] = useState(String(hari))
  const [dari, setDari] = useState(jamMulai.slice(0, 5))
  const [sampai, setSampai] = useState(jamSelesai.slice(0, 5))
  const [tmp, setTmp] = useState(tempat)

  const simpan = () => mulai(async () => {
    const r = await ubahJadwalEkstraGuruAction(slotId, { hari: Number(h), jam_mulai: dari, jam_selesai: sampai, tempat: tmp })
    if (r.error) { toast.error(r.error); return }
    toast.success('Jadwal tersimpan.')
    setBuka(false)
    router.refresh()
  })

  if (!buka) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{label}{tempat ? ` · ${tempat}` : ''} · {jumlahPeserta} peserta</span>
        <button type="button" onClick={() => setBuka(true)} className="inline-flex items-center gap-1 underline hover:text-foreground">
          <Pencil className="h-3 w-3" /> Ubah jadwal
        </button>
      </p>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <select value={h} onChange={e => setH(e.target.value)} aria-label="Hari"
          className="col-span-2 h-9 rounded-md border bg-background px-2 text-sm sm:col-span-1">
          {HARI_EKSTRA.slice(1).map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        <Input type="time" value={dari} onChange={e => setDari(e.target.value)} aria-label="Jam mulai" className="h-9" />
        <Input type="time" value={sampai} onChange={e => setSampai(e.target.value)} aria-label="Jam selesai" className="h-9" />
      </div>
      <Input value={tmp} onChange={e => setTmp(e.target.value)} maxLength={120} placeholder="Tempat, mis. Kelas 2A / daring" aria-label="Tempat" className="h-9" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !dari || !sampai} onClick={simpan}>{pending ? 'Menyimpan…' : 'Simpan jadwal'}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setBuka(false)}>Batal</Button>
      </div>
    </div>
  )
}
