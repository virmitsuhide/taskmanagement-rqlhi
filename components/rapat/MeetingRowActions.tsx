'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { deleteMeetingFromListAction } from '@/app/actions/meetings'

interface Props {
  meetingId: string
  subject: string
}

export function MeetingRowActions({ meetingId, subject }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Hapus rapat "${subject}"? Notulen & agenda ikut terhapus permanen.`)) return
    setDeleting(true)
    const res = await deleteMeetingFromListAction(meetingId)
    setDeleting(false)
    if (res?.error) toast.error(res.error)
    else { toast.success('Rapat dihapus'); router.refresh() }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/rapat/${meetingId}`}
        aria-label="Lihat notulen"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <Link
        href={`/rapat/${meetingId}/edit`}
        aria-label="Edit rapat"
        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Hapus rapat"
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
