'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BookOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { hapusSetoranLuarAction, simpanSetoranLuarAction } from '@/app/actions/ekstra'
import { LABEL_STATUS_TAHSIN, URUTAN_STATUS_TAHSIN } from '@/lib/rq/status-tahsin'
import type { MetodeLuar, PosisiLuar } from '@/lib/data/ekstra-luar'
import type { TahsinStatus } from '@/types'

export interface BarisLuar {
  bookingId: string
  nama: string
  /** Tidak hadir (izin/sakit/alfa) pada tanggal ini — tidak bisa disetor. */
  absen: boolean
  posisi: PosisiLuar
  teksPosisi: string
  /** Setoran pada tanggal pertemuan ini. */
  hariIni: { id: string; ringkas: string; status: TahsinStatus }[]
}

/**
 * Setoran tahsin peserta non-LHI (0122) — tersimpan di data peserta ekstra
 * sendiri, bukan di data siswa. Posisi awal diisi dari posisi terakhirnya.
 */
export function SetorLuarEkstra({ slotId, tanggal, peserta, metode }: {
  slotId: string
  tanggal: string
  peserta: BarisLuar[]
  metode: MetodeLuar[]
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {peserta.map(p => <Baris key={p.bookingId} slotId={slotId} tanggal={tanggal} p={p} metode={metode} />)}
    </ul>
  )
}

function Baris({ slotId, tanggal, p, metode }: { slotId: string; tanggal: string; p: BarisLuar; metode: MetodeLuar[] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [buka, setBuka] = useState(false)

  const hapus = (id: string) => mulai(async () => {
    const r = await hapusSetoranLuarAction(id)
    if (r.error) { toast.error(r.error); return }
    toast.success('Setoran dihapus.')
    router.refresh()
  })

  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{p.nama}</span>
          <span className="block truncate text-xs text-muted-foreground">Posisi: {p.teksPosisi}</span>
        </span>
        {p.absen ? <span className="text-xs text-muted-foreground">tidak hadir</span> : !buka && (
          <Button size="sm" variant="outline" onClick={() => setBuka(true)}><BookOpen className="mr-1 h-3.5 w-3.5" />Setor</Button>
        )}
      </div>
      {p.hariIni.length > 0 && (
        <ul className="space-y-1">
          {p.hariIni.map(s => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{s.ringkas} · <b>{LABEL_STATUS_TAHSIN[s.status]}</b></span>
              <button type="button" onClick={() => hapus(s.id)} disabled={pending} aria-label="Hapus setoran"
                className="text-muted-foreground hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {buka && <FormSetor slotId={slotId} tanggal={tanggal} p={p} metode={metode} tutup={() => setBuka(false)} />}
    </li>
  )
}

function FormSetor({ slotId, tanggal, p, metode, tutup }: { slotId: string; tanggal: string; p: BarisLuar; metode: MetodeLuar[]; tutup: () => void }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [metodeId, setMetodeId] = useState(p.posisi.method_id ?? metode[0]?.id ?? '')
  const [jilidId, setJilidId] = useState(p.posisi.jilid_id ?? '')
  const [halaman, setHalaman] = useState(p.posisi.halaman ? String(p.posisi.halaman) : '')
  const [status, setStatus] = useState<TahsinStatus>('lulus')
  const [dari, setDari] = useState('')
  const [ke, setKe] = useState('')
  const [catatan, setCatatan] = useState('')

  const daftarJilid = metode.find(m => m.id === metodeId)?.jilid ?? []
  const jilid = daftarJilid.find(j => j.id === jilidId)
  const angka = (v: string) => (v.trim() ? Number(v) : null)

  const simpan = () => mulai(async () => {
    const r = await simpanSetoranLuarAction(slotId, p.bookingId, tanggal, {
      jilid_id: jilidId, halaman: angka(halaman), baris_dari: angka(dari), baris_ke: angka(ke), status, catatan,
    })
    if (r.error) { toast.error(r.error); return }
    toast.success(`Setoran ${p.nama} tersimpan.`)
    tutup()
    router.refresh()
  })

  return (
    <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={metodeId} onChange={e => { setMetodeId(e.target.value); setJilidId('') }} aria-label="Metode"
          className="h-9 rounded-md border bg-background px-2 text-sm">
          {metode.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={jilidId} onChange={e => setJilidId(e.target.value)} aria-label="Jilid / tahap"
          className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">— Jilid / tahap —</option>
          {daftarJilid.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}
        </select>
        <Input value={halaman} onChange={e => setHalaman(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
          placeholder={jilid && !jilid.total_pages ? 'Hal. mushaf (opsional)' : `Halaman${jilid?.total_pages ? ` 1–${jilid.total_pages}` : ''}`}
          aria-label="Halaman" className="h-9" />
      </div>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
        {URUTAN_STATUS_TAHSIN.map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
            className={cn('h-8 rounded-lg border px-3 text-xs font-semibold',
              status === s ? (s === 'ulang' ? 'bg-destructive text-white' : s === 'lanjut' ? 'bg-warning text-warning-foreground' : 'bg-success text-white') : 'bg-card text-muted-foreground')}>
            {LABEL_STATUS_TAHSIN[s]}
          </button>
        ))}
      </div>
      {status === 'lanjut' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Baris</span>
          <Input value={dari} onChange={e => setDari(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="dari" aria-label="Dari baris" className="h-8 w-16" />
          <span>–</span>
          <Input value={ke} onChange={e => setKe(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="sampai" aria-label="Sampai baris" className="h-8 w-16" />
        </div>
      )}
      <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan" maxLength={300} className="h-9" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !jilidId} onClick={simpan}>{pending ? 'Menyimpan…' : 'Simpan setoran'}</Button>
        <Button size="sm" variant="ghost" onClick={tutup}>Batal</Button>
      </div>
    </div>
  )
}
