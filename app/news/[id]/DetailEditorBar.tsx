'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Pencil, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toggleNewsAction, deleteNewsAction } from '@/app/actions/news'

interface Props {
  newsId: string
  isActive: boolean
}

export function DetailEditorBar({ newsId, isActive }: Props) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleNewsAction(newsId, !isActive)
    })
  }

  function handleDelete() {
    if (!confirm('Hapus berita ini? Tindakan tidak bisa dibatalkan.')) return
    startTransition(async () => {
      await deleteNewsAction(newsId)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/news/${newsId}/edit`}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border bg-card hover:bg-muted transition-colors"
      >
        <Pencil className="h-3 w-3" /> Edit
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border bg-card hover:bg-muted transition-colors disabled:opacity-50"
        title={isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {isActive ? <><EyeOff className="h-3 w-3" /> Nonaktifkan</> : <><Eye className="h-3 w-3" /> Aktifkan</>}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        title="Hapus"
      >
        <Trash2 className="h-3 w-3" /> Hapus
      </button>
    </div>
  )
}
