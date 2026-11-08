'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aturAktifHalaqohEkstraAction } from '@/app/actions/ekstra'

/**
 * Pita di halaman halaqoh ekstra yang nonaktif. Menegaskan bahwa datanya
 * tidak hilang (nonaktif ≠ dihapus) dan memberi satu tombol untuk
 * mengaktifkannya kembali.
 */
export function PitaHalaqohNonaktif({ slotId, peserta, pertemuan }: {
  slotId: string
  /** Peserta yang masih tercatat aktif di halaqoh ini. */
  peserta: number
  /** Pertemuan tercatat bulan ini. */
  pertemuan: number
}) {
  const [pending, mulai] = useTransition()
  const aktifkan = () => mulai(async () => {
    const r = await aturAktifHalaqohEkstraAction(slotId, true)
    if (r.error) { toast.error(r.error); return }
    toast.success('Halaqoh aktif kembali. Peserta & setorannya tampil lagi di jadwal guru.')
  })

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent-warm/40 bg-accent-warm-wash px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Halaqoh ini nonaktif</p>
        <p className="text-xs text-muted-foreground">
          Tidak tampil di jadwal guru dan daftar halaqoh. Datanya tidak dihapus:
          {' '}{peserta} peserta, kehadiran, dan seluruh setoran{pertemuan ? ` (${pertemuan} pertemuan bulan ini)` : ''} tetap tersimpan
          dan muncul lagi begitu halaqoh diaktifkan.
        </p>
      </div>
      <Button size="sm" disabled={pending} onClick={aktifkan}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{pending ? 'Mengaktifkan…' : 'Aktifkan kembali'}
      </Button>
    </div>
  )
}
