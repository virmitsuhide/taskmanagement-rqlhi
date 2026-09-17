'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BadgeCheck, Handshake } from 'lucide-react'
import { jawabAjakanRutinAction, konfirmasiSelesaiRutinAction } from '@/app/actions/rutin'
import { Button } from '@/components/ui/button'
import { CADENCE_LABELS, labelPeriode } from '@/lib/rutin/periode'
import type { UndanganRutin } from '@/lib/data/rutin'
import type { RoutineTaskState } from '@/types'

/**
 * Kartu yang menunggu keputusan pemirsa, di puncak halaman Tugas Rutin:
 * ajakan tugas bersama, dan laporan terlaksana rekan yang perlu diiyakan.
 *
 * Sengaja kartu di halaman ini, bukan hanya lonceng: keputusannya diambil di
 * tempat tugas itu akan dikerjakan, dan kartu tidak hilang sebelum dijawab.
 */
export function KartuRutinBersama({ undangan, perluKonfirmasi }: {
  undangan: UndanganRutin[]
  perluKonfirmasi: RoutineTaskState[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (undangan.length === 0 && perluKonfirmasi.length === 0) return null

  const jalankan = (fn: () => Promise<{ error?: string; success?: boolean }>, sukses: string) =>
    startTransition(async () => {
      const r = await fn()
      if (r.error) { toast.error(r.error); return }
      toast.success(sukses)
      router.refresh()
    })

  return (
    <div className="mb-5 space-y-2.5">
      {undangan.map(u => (
        <div key={u.task.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Handshake className="h-4 w-4" /> Ajakan tugas rutin bersama
          </p>
          <p className="mt-1.5 text-sm">
            <strong>{u.pengajak}</strong> mengajak Anda mengerjakan:
          </p>
          <p className="mt-1 rounded-lg bg-card px-3 py-2 text-sm font-medium">{u.task.description}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {CADENCE_LABELS[u.task.cadence]}
            {u.rekanLain.length > 0 && ` · juga diajak: ${u.rekanLain.join(', ')}`}
            {' · '}bila diterima, tugas ini muncul di checklist Anda dan laporan terlaksana dari salah satu pihak perlu dikonfirmasi pihak lain.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => jalankan(() => jawabAjakanRutinAction(u.task.id, true), 'Ajakan diterima — tugasnya kini ada di checklist Anda.')}>
              Terima
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => jalankan(() => jawabAjakanRutinAction(u.task.id, false), 'Ajakan ditolak.')}>
              Tolak
            </Button>
          </div>
        </div>
      ))}

      {perluKonfirmasi.map(s => {
        const l = s.bersama!.laporan!
        return (
          <div key={s.task.id} className="rounded-xl border border-warning/40 bg-warning-wash p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <BadgeCheck className="h-4 w-4" /> Konfirmasi tugas selesai
            </p>
            <p className="mt-1.5 text-sm">
              <strong>{l.pelapor.label}</strong> menandai tugas bersama ini <strong>terlaksana</strong> untuk periode {labelPeriode(s.task.cadence)}:
            </p>
            <p className="mt-1 rounded-lg bg-card px-3 py-2 text-sm font-medium">{s.task.description}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Benar sudah selesai? Tugas baru tercentang setelah semua rekan menyetujui.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => jalankan(() => konfirmasiSelesaiRutinAction(s.task.id, true), 'Dikonfirmasi selesai.')}>
                Ya, sudah selesai
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => jalankan(() => konfirmasiSelesaiRutinAction(s.task.id, false), 'Laporan belum disetujui — pelapor akan melihatnya.')}>
                Belum selesai
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
