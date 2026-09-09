'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'

import { restoreMeetingAction, purgeMeetingAction } from '@/app/actions/meetings'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'

interface Props {
  meetingId: string
  subject: string
  agendaCount: number
}

export function TrashRowActions({ meetingId, subject, agendaCount }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, setPending] = useState(false)

  async function pulihkan() {
    setPending(true)
    const res = await restoreMeetingAction(meetingId)
    setPending(false)
    if (res?.error) toast.error(res.error)
    else {
      toast.success('Rapat dipulihkan ke daftar')
      router.refresh()
    }
  }

  async function hapusPermanen() {
    const ok = await confirm({
      title: `Hapus "${subject}" untuk selamanya?`,
      description:
        `Rapat ini beserta ${agendaCount} butir agenda dan notulennya dibuang dari ` +
        'database dan tidak bisa dipulihkan oleh siapa pun, termasuk Anda. ' +
        'Kalau ragu, biarkan saja di keranjang — tidak ada batas waktunya.',
      confirmText: 'Hapus selamanya',
    })
    if (!ok) return

    setPending(true)
    const res = await purgeMeetingAction(meetingId)
    setPending(false)
    if (res?.error) toast.error(res.error)
    else {
      toast.success('Rapat dihapus permanen')
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={pending} onClick={pulihkan}>
        <RotateCcw className="h-3.5 w-3.5" />
        Pulihkan
      </Button>
      <Button size="sm" variant="destructive" disabled={pending} onClick={hapusPermanen}>
        <Trash2 className="h-3.5 w-3.5" />
        Hapus permanen
      </Button>
    </div>
  )
}
