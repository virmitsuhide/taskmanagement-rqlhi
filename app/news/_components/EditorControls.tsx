'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Pencil, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toggleNewsAction, deleteNewsAction } from '@/app/actions/news'

interface Props {
  newsId: string
  isActive: boolean
  size?: 'sm' | 'md'
}

export function EditorControls({ newsId, isActive, size = 'sm' }: Props) {
  const [pending, startTransition] = useTransition()
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const pad = size === 'sm' ? 'p-1' : 'p-1.5'

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await toggleNewsAction(newsId, !isActive)
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Hapus berita ini? Tindakan tidak bisa dibatalkan.')) return
    startTransition(async () => {
      await deleteNewsAction(newsId)
    })
  }

  return (
    <div
      className="absolute top-2 right-2 z-10 flex gap-1 bg-card/90 backdrop-blur rounded-md p-0.5 border shadow-sm"
      onClick={e => e.stopPropagation()}
    >
      <Link
        href={`/news/${newsId}/edit`}
        title="Edit"
        className={`${pad} rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors`}
        onClick={e => e.stopPropagation()}
      >
        <Pencil className={icon} />
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        title={isActive ? 'Nonaktifkan' : 'Aktifkan'}
        className={`${pad} rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50`}
      >
        {isActive ? <EyeOff className={icon} /> : <Eye className={icon} />}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Hapus"
        className={`${pad} rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50`}
      >
        <Trash2 className={icon} />
      </button>
    </div>
  )
}
