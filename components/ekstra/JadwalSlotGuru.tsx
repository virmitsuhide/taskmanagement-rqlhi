'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ubahJadwalEkstraGuruAction } from '@/app/actions/ekstra'
import type { WaktuEkstra } from '@/lib/data/ekstra'
import { EditorJadwalEkstra } from '@/components/ekstra/EditorJadwalEkstra'

/**
 * Baris jadwal halaqoh ekstra di portal guru + tombol "Ubah jadwal": pengampu
 * mengatur sendiri waktu-waktunya sepekan (lihat ubahJadwalEkstraGuruAction).
 */
export function JadwalSlotGuru({ slotId, label, jadwal, jumlahPeserta }: {
  slotId: string
  /** "Senin 15.30–16.30 · Sabtu 07.15–08.15 & 15.30–16.30" */
  label: string
  /** Semua waktu sepekan — jadwalSlot(). */
  jadwal: WaktuEkstra[]
  jumlahPeserta: number
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [buka, setBuka] = useState(false)
  const [waktu, setWaktu] = useState(jadwal)
  // Tempat ditampilkan sekali bila semua waktu di tempat yang sama.
  const tempat = [...new Set(jadwal.map(w => w.tempat).filter(Boolean))]

  const simpan = () => mulai(async () => {
    const r = await ubahJadwalEkstraGuruAction(slotId, waktu)
    if (r.error) { toast.error(r.error); return }
    toast.success('Jadwal tersimpan.')
    setBuka(false)
    router.refresh()
  })

  if (!buka) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{label}{tempat.length > 0 ? ` · ${tempat.join(' / ')}` : ''} · {jumlahPeserta} peserta</span>
        <button type="button" onClick={() => { setWaktu(jadwal); setBuka(true) }} className="inline-flex items-center gap-1 underline hover:text-foreground">
          <Pencil className="h-3 w-3" /> Ubah jadwal
        </button>
      </p>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3">
      <p className="text-xs font-medium">Waktu halaqoh sepekan</p>
      <EditorJadwalEkstra value={waktu} onChange={setWaktu} />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={simpan}>{pending ? 'Menyimpan…' : 'Simpan jadwal'}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setBuka(false)}>Batal</Button>
      </div>
    </div>
  )
}
