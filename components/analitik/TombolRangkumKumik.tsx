'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Repeat2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { rangkumUnitKumikAction } from '@/app/actions/rangkum-kumik'
import type { Jenjang } from '@/types'

/**
 * Rangkum Capaian Bulanan seluruh halaqoh satu unit dari setoran guru —
 * hanya mengisi yang masih kosong (lihat rangkumUnitKumikAction).
 */
export function TombolRangkumKumik({ jenjang, bulan, labelUnit, labelBulan }: {
  jenjang: Jenjang; bulan: string; labelUnit: string; labelBulan: string
}) {
  const [pending, start] = useTransition()
  const confirm = useConfirm()
  const router = useRouter()

  async function jalankan() {
    const ok = await confirm({
      title: `Rangkum capaian ${labelUnit} — ${labelBulan}?`,
      description: 'Capaian akhir bulan diisi dari setoran harian guru, capaian awal dari akhir bulan sebelumnya. Hanya kolom yang masih kosong yang diisi — isian guru tidak ditimpa.',
      confirmText: 'Rangkum',
    })
    if (!ok) return
    start(async () => {
      const r = await rangkumUnitKumikAction(jenjang, bulan)
      if (r.error) { toast.error(r.error); return }
      const bagian = [
        `${r.akhirDiisi} capaian akhir`,
        `${r.awalDiisi} capaian awal`,
      ]
      toast.success(`Dirangkum: ${bagian.join(' · ')}`, {
        description: r.akhirSudahAda ? `${r.akhirSudahAda} anak sudah diisi guru, dibiarkan.` : undefined,
      })
      router.refresh()
    })
  }

  return (
    <Button size="sm" variant="outline" onClick={jalankan} disabled={pending} className="gap-1.5">
      <Repeat2 className="size-4" aria-hidden />
      {pending ? 'Merangkum…' : 'Rangkum capaian dari setoran'}
    </Button>
  )
}
