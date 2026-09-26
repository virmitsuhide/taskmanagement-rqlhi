'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowRightLeft, UserCheck, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pindahHalaqohEkstraAction, tautkanSiswaEkstraAction, ubahStatusBookingAction } from '@/app/actions/ekstra'
import { PilihSiswa } from '@/components/ekstra/PilihSiswa'
import type { CalonSiswa } from '@/lib/data/ekstra'

/**
 * Tindakan untuk satu peserta di halaman halaqoh ekstra: tautkan ke data
 * siswa (siswa LHI), pindahkan ke halaqoh lain berjenis sama, atau berhentikan.
 */
export function AksiPesertaEkstra({ id, nama, tujuan, calon }: {
  id: string
  nama: string
  /** Halaqoh lain berjenis sama yang masih ada kursi. */
  tujuan: { id: string; label: string }[]
  /** Calon data siswa untuk siswa LHI yang belum tertaut; kosong = tidak perlu. */
  calon: CalonSiswa[] | null
}) {
  const [pending, mulai] = useTransition()
  const [mode, setMode] = useState<null | 'pindah' | 'berhenti' | 'tautkan'>(null)
  const [pilih, setPilih] = useState('')
  const [catatan, setCatatan] = useState('')

  const jalankan = (fn: () => Promise<{ error?: string }>, pesan: string) => mulai(async () => {
    const r = await fn()
    if (r.error) { toast.error(r.error); return }
    toast.success(pesan)
    setMode(null); setPilih(''); setCatatan('')
  })

  if (mode === 'tautkan') {
    return (
      <div className="flex flex-wrap items-start gap-2">
        <PilihSiswa id={`siswa-${id}`} calon={calon ?? []} value={pilih} onChange={setPilih} />
        <Button size="sm" disabled={pending || !pilih} onClick={() => jalankan(() => tautkanSiswaEkstraAction(id, pilih), `${nama} ditautkan ke data siswa.`)}>
          Simpan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
      </div>
    )
  }

  if (mode === 'pindah') {
    const opsi = tujuan
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select value={pilih} onChange={e => setPilih(e.target.value)} aria-label={`Halaqoh tujuan ${nama}`}
          className="h-8 min-w-0 max-w-[16rem] rounded-md border bg-background px-2 text-xs">
          <option value="">— Pilih halaqoh tujuan —</option>
          {opsi.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <Button size="sm" disabled={pending || !pilih} onClick={() => jalankan(() => pindahHalaqohEkstraAction(id, pilih), `${nama} dipindahkan.`)}>
          Simpan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
      </div>
    )
  }

  if (mode === 'berhenti') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Alasan berhenti (internal)"
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
        <Button size="sm" variant="destructive" disabled={pending}
          onClick={() => jalankan(() => ubahStatusBookingAction(id, 'berhenti', catatan), `${nama} diberhentikan.`)}>
          Berhentikan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {calon && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('tautkan')} title="Tautkan ke data siswa LHI">
          <UserCheck className="mr-1 h-3.5 w-3.5" />Tautkan
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending || tujuan.length === 0} onClick={() => setMode('pindah')}
        title={tujuan.length === 0 ? 'Tidak ada halaqoh lain berjenis sama yang masih ada kursi' : 'Pindahkan ke halaqoh lain'}>
        <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />Pindah
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('berhenti')}>
        <UserMinus className="mr-1 h-3.5 w-3.5" />Berhenti
      </Button>
    </div>
  )
}
