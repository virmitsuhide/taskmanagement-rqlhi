'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { tautkanSiswaEkstraAction } from '@/app/actions/ekstra'
import { PilihSiswa } from '@/components/ekstra/PilihSiswa'
import type { CalonSiswa } from '@/lib/data/ekstra'

export interface BelumTertaut {
  id: string
  nama: string
  kelas: string
  halaqoh: string
  calon: CalonSiswa[]
}

/**
 * Peserta ekstra asal LHI yang belum tertaut ke data siswa — ditautkan satu per
 * satu langsung di sini. Calon teratas (nama mirip, kelas sama) dipilihkan.
 */
export function TautkanBelumTertaut({ daftar }: { daftar: BelumTertaut[] }) {
  const [buka, setBuka] = useState(false)
  return (
    <div className="rounded-2xl bg-accent-warm-wash">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-accent-warm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-accent-warm">{daftar.length} siswa LHI belum tertaut ke data siswa</p>
          <p className="text-sm">Guru belum bisa mencatat setoran mereka, dan capaian sekolahnya tidak ikut maju.</p>
        </div>
        <button type="button" onClick={() => setBuka(b => !b)} aria-expanded={buka}
          className="inline-flex h-9 items-center rounded-xl bg-accent-warm px-4 text-sm font-bold text-white hover:opacity-90">
          {buka ? 'Tutup' : 'Tautkan sekarang'}
        </button>
      </div>
      {buka && (
        <ul className="divide-y border-t border-accent-warm/20 bg-card/70">
          {daftar.map(d => <Baris key={d.id} d={d} />)}
        </ul>
      )}
    </div>
  )
}

function Baris({ d }: { d: BelumTertaut }) {
  const [pending, mulai] = useTransition()
  const [pilih, setPilih] = useState(d.calon[0]?.id ?? '')

  const simpan = () => mulai(async () => {
    const r = await tautkanSiswaEkstraAction(d.id, pilih)
    if (r.error) { toast.error(r.error); return }
    toast.success(`${d.nama} ditautkan ke data siswa.`)
  })

  return (
    <li className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-start">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{d.nama}</p>
        <p className="truncate text-xs text-muted-foreground">{[d.kelas && `Kelas ${d.kelas}`, d.halaqoh].filter(Boolean).join(' · ')}</p>
      </div>
      <PilihSiswa id={`taut-${d.id}`} calon={d.calon} value={pilih} onChange={setPilih} />
      <Button size="sm" disabled={pending || !pilih} onClick={simpan}>
        <UserCheck className="mr-1 h-3.5 w-3.5" />{pending ? 'Menyimpan…' : 'Tautkan'}
      </Button>
    </li>
  )
}
