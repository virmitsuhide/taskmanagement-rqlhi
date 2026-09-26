'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { hapusSetoranGuruAction } from '@/app/actions/setoran-guru'

export function HapusSetoranGuru({ id, label }: { id: string; label: string }) {
  const [pending, mulai] = useTransition()
  return (
    <button type="button" disabled={pending} aria-label={`Hapus setoran ${label}`} title="Hapus setoran"
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Hapus setoran ${label}? Posisi hafalan di KPI bulan ini ikut dihitung ulang.`)) return
        mulai(async () => {
          const r = await hapusSetoranGuruAction(id)
          if (r.error) toast.error(r.error)
          else toast.success('Setoran dihapus.')
        })
      }}>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
