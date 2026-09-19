'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  putuskanApprovalAction, simpanBiayaAction, tandaiDiskusiSelesaiAction, arsipkanPoinAction,
} from '@/app/actions/papan-rapat'
import type { ApprovalStatus } from '@/types'

type Varian = 'default' | 'outline' | 'ghost' | 'destructive'

/**
 * Satu tombol = satu server action. Action memanggil revalidatePath, jadi papan
 * tersegarkan sendiri; di sini cukup menampilkan galat bila ditolak.
 */
function TombolAksi({ label, jalankan, varian = 'outline', sukses, icon }: {
  label: string
  jalankan: () => Promise<{ error?: string }>
  varian?: Varian
  sukses?: string
  icon?: React.ReactNode
}) {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      size="sm"
      variant={varian}
      disabled={pending}
      className="h-7 px-2.5 text-xs"
      onClick={() => start(async () => {
        const r = await jalankan()
        if (r.error) toast.error(r.error)
        else if (sukses) toast.success(sukses)
      })}
    >
      {pending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : icon}
      {label}
    </Button>
  )
}

export function AksiApproval({ id, status }: { id: string; status: ApprovalStatus }) {
  if (status === 'menunggu') {
    return (
      <div className="flex gap-1.5">
        <TombolAksi label="Setujui" varian="default" sukses="Approval disetujui"
          jalankan={() => putuskanApprovalAction(id, 'disetujui')} />
        <TombolAksi label="Tolak" varian="outline" sukses="Approval ditolak"
          jalankan={() => putuskanApprovalAction(id, 'ditolak')} />
      </div>
    )
  }
  return <TombolAksi label="Batalkan keputusan" varian="ghost" jalankan={() => putuskanApprovalAction(id, 'menunggu')} />
}

export function AksiDiskusi({ id, selesai }: { id: string; selesai: boolean }) {
  return selesai
    ? <TombolAksi label="Buka lagi" varian="ghost" jalankan={() => tandaiDiskusiSelesaiAction(id, false)} />
    : <TombolAksi label="Tandai selesai" varian="default" sukses="Diskusi ditandai selesai" jalankan={() => tandaiDiskusiSelesaiAction(id, true)} />
}

export function AksiArsip({ id, arsip }: { id: string; arsip: boolean }) {
  return arsip
    ? <TombolAksi label="Keluarkan dari papan" varian="outline" sukses="Poin dikeluarkan dari papan aktif" jalankan={() => arsipkanPoinAction(id, true)} />
    : <TombolAksi label="Kembalikan ke papan" varian="outline" sukses="Poin kembali ke papan aktif" jalankan={() => arsipkanPoinAction(id, false)} />
}

/** Isian biaya bendahara. Nominal ditulis bebas ("1.500.000"); server membuang selain angka. */
export function FormBiaya({ id, biaya, catatan }: { id: string; biaya: number | null; catatan: string | null }) {
  const [nominal, setNominal] = useState(biaya !== null ? biaya.toLocaleString('id-ID') : '')
  const [ket, setKet] = useState(catatan ?? '')
  const [pending, start] = useTransition()
  return (
    <form
      className="space-y-1.5"
      onSubmit={e => {
        e.preventDefault()
        start(async () => {
          const r = await simpanBiayaAction(id, nominal, ket)
          if (r.error) toast.error(r.error)
          else toast.success(nominal ? 'Biaya tersimpan' : 'Biaya dikosongkan')
        })
      }}
    >
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
          <Input
            value={nominal}
            onChange={e => {
              const angka = e.target.value.replace(/\D/g, '')
              setNominal(angka ? Number(angka).toLocaleString('id-ID') : '')
            }}
            inputMode="numeric"
            placeholder="0"
            aria-label="Nominal biaya"
            className="h-8 pl-8 text-sm tabular-nums"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending} className="h-8 px-3 text-xs">
          {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Simpan
        </Button>
      </div>
      <Input value={ket} onChange={e => setKet(e.target.value)} placeholder="Catatan (opsional), mis. sumber dana"
        aria-label="Catatan biaya" className="h-8 text-xs" />
    </form>
  )
}
