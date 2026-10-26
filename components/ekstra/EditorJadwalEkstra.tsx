'use client'

import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { HARI_EKSTRA, type WaktuEkstra } from '@/lib/data/ekstra'
import { MAKS_WAKTU_EKSTRA } from '@/lib/rq/jadwal-ekstra'

/** '15:30' + 60 menit → '16:30' (dibatasi 23:59). */
function tambahMenit(j: string, menit: number): string {
  const [h, m] = j.split(':').map(Number)
  const t = Math.min(h * 60 + m + menit, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/**
 * Daftar waktu halaqoh ekstra sepekan (0125): beberapa hari, dan boleh dua
 * waktu di hari yang sama (pagi & sore). Waktu baru menyalin hari & tempat
 * baris terakhir dengan jam sore — kasus paling umum "pagi & sore".
 * Pemeriksaan sungguhan (bertumpuk, jam terbalik) di periksaJadwalEkstra.
 */
export function EditorJadwalEkstra({ value, onChange }: { value: WaktuEkstra[]; onChange: (v: WaktuEkstra[]) => void }) {
  const ubah = (i: number, isi: Partial<WaktuEkstra>) => onChange(value.map((w, j) => j === i ? { ...w, ...isi } : w))
  const tambah = () => {
    const akhir = value[value.length - 1]
    const mulai = akhir && akhir.jam_mulai < '12:00' ? '15:30' : '07:00'
    onChange([...value, { hari: akhir?.hari ?? 1, jam_mulai: mulai, jam_selesai: tambahMenit(mulai, 60), tempat: akhir?.tempat ?? '' }])
  }

  return (
    <div className="space-y-2">
      {value.map((w, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[8rem_6.5rem_6.5rem_1fr_auto]">
          <select value={w.hari} onChange={e => ubah(i, { hari: Number(e.target.value) })} aria-label={`Hari waktu ${i + 1}`}
            className="col-span-2 h-9 rounded-md border bg-background px-2 text-sm sm:col-span-1">
            {HARI_EKSTRA.slice(1).map((n, h) => <option key={n} value={h + 1}>{n}</option>)}
          </select>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} disabled={value.length === 1}
            aria-label={`Hapus waktu ${i + 1}`} title={value.length === 1 ? 'Sedikitnya satu waktu' : 'Hapus waktu ini'}
            className="row-start-1 col-start-3 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 sm:col-start-5">
            <X className="h-4 w-4" />
          </button>
          <Input type="time" value={w.jam_mulai}
            onChange={e => ubah(i, { jam_mulai: e.target.value, ...(e.target.value >= w.jam_selesai ? { jam_selesai: tambahMenit(e.target.value, 60) } : {}) })}
            aria-label={`Jam mulai waktu ${i + 1}`} className="h-9" />
          <Input type="time" value={w.jam_selesai} onChange={e => ubah(i, { jam_selesai: e.target.value })}
            aria-label={`Jam selesai waktu ${i + 1}`} className="h-9" />
          <Input value={w.tempat} onChange={e => ubah(i, { tempat: e.target.value })} maxLength={120}
            placeholder="Tempat, mis. Kelas 2A / Online" aria-label={`Tempat waktu ${i + 1}`} className="col-span-3 h-9 sm:col-span-1" />
        </div>
      ))}
      {value.length < MAKS_WAKTU_EKSTRA && (
        <button type="button" onClick={tambah}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Tambah waktu
        </button>
      )}
    </div>
  )
}
