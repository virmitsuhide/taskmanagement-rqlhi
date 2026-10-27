'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock } from 'lucide-react'
import { pindahTanggalEkstraAction } from '@/app/actions/ekstra'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface PertemuanEkstra {
  tanggal: string
  setoran: number
  hadir: number
}

function teksTanggal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Pindahkan satu pertemuan halaqoh ekstra (setoran + kehadiran + materi) ke
 * tanggal lain sekaligus — untuk guru yang menyetor dengan tanggal keliru.
 */
export function PindahTanggalEkstra({ slotId, pertemuan, maks }: { slotId: string; pertemuan: PertemuanEkstra[]; maks: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dari, setDari] = useState(pertemuan[0]?.tanggal ?? '')
  const [ke, setKe] = useState('')

  if (pertemuan.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada pertemuan tercatat di bulan ini.</p>
  }

  function pindah() {
    if (!dari || !ke) return
    if (!confirm(`Pindahkan seluruh data pertemuan ${teksTanggal(dari)} ke ${teksTanggal(ke)}?`)) return
    startTransition(async () => {
      const hasil = await pindahTanggalEkstraAction(slotId, dari, ke)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(`${hasil.jumlah ?? 0} data dipindah ke ${teksTanggal(ke)} — posisi anak dihitung ulang.`)
      setKe('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor={`pindah_dari_${slotId}`} className="text-xs font-medium">Pertemuan</label>
        <select id={`pindah_dari_${slotId}`} value={dari} onChange={e => setDari(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 text-sm">
          {pertemuan.map(p => (
            <option key={p.tanggal} value={p.tanggal}>
              {teksTanggal(p.tanggal)} · {p.setoran} setoran{p.hadir ? ` · ${p.hadir} presensi` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`pindah_ke_${slotId}`} className="text-xs font-medium">Pindah ke tanggal</label>
        <Input id={`pindah_ke_${slotId}`} type="date" value={ke} max={maks} onChange={e => setKe(e.target.value)} className="h-9 w-44" />
      </div>
      <Button type="button" size="sm" onClick={pindah} disabled={pending || !dari || !ke || dari === ke}>
        <CalendarClock className="h-4 w-4" />{pending ? 'Memindahkan…' : 'Pindahkan'}
      </Button>
    </div>
  )
}
