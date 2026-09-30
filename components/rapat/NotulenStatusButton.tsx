'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { terbitkanNotulen, kembalikanKeDraf } from '@/app/actions/notulen-status'

interface Props {
  meetingId: string
  status: 'draf' | 'terbit'
}

/** Tombol Terbitkan / Kembalikan ke draf untuk yang boleh menyunting notulen. */
export function NotulenStatusButton({ meetingId, status }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, start] = useTransition()
  const terbit = status === 'terbit'

  async function handleClick() {
    const ok = await confirm(
      terbit
        ? {
            title: 'Kembalikan notulen ke draf?',
            description: 'Pembaca akan melihat tanda bahwa isinya masih bisa berubah. Notulen tetap bisa dibaca seperti biasa.',
            confirmText: 'Kembalikan ke draf',
            tone: 'default',
          }
        : {
            title: 'Terbitkan notulen ini?',
            description: 'Notulen ditandai final. Anda masih bisa mengembalikannya ke draf nanti.',
            confirmText: 'Terbitkan',
            tone: 'default',
          },
    )
    if (!ok) return
    start(async () => {
      const res = terbit ? await kembalikanKeDraf(meetingId) : await terbitkanNotulen(meetingId)
      if ('error' in res) toast.error(res.error)
      else {
        toast.success(terbit ? 'Notulen dikembalikan ke draf' : 'Notulen diterbitkan')
        router.refresh()
      }
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={terbit ? 'outline' : 'default'}
      disabled={pending}
      onClick={handleClick}
      className="print:hidden"
    >
      {terbit ? <Undo2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      {pending ? 'Menyimpan…' : terbit ? 'Kembalikan ke draf' : 'Terbitkan notulen'}
    </Button>
  )
}
