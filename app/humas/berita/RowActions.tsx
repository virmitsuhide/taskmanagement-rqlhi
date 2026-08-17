'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Eye, EyeOff, Trash2, ExternalLink } from 'lucide-react'
import { toggleNewsAction, deleteNewsAction } from '@/app/actions/news'

interface Props {
  newsId: string
  title: string
  isActive: boolean
}

const BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none'

export function RowActions({ newsId, title, isActive }: Props) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleNewsAction(newsId, !isActive)
      if (result?.error) toast.error(result.error)
      else toast.success(isActive ? 'Berita disembunyikan dari publik' : 'Berita diterbitkan')
    })
  }

  function handleDelete() {
    // Hard delete — sengaja pakai konfirmasi yang menyebut judulnya supaya
    // tidak ada artikel terbit yang terhapus karena salah baris.
    if (!confirm(`Hapus "${title}"? Tindakan ini tidak bisa dibatalkan.`)) return
    startTransition(async () => {
      const result = await deleteNewsAction(newsId)
      if (result?.error) toast.error(result.error)
      else toast.success('Berita dihapus')
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Link href={`/news/${newsId}`} target="_blank" title="Lihat di halaman publik" className={BTN}>
        <ExternalLink className="h-3.5 w-3.5" />
        <span className="sr-only">Lihat {title}</span>
      </Link>
      <Link href={`/news/${newsId}/edit`} title="Edit" className={BTN}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Edit {title}</span>
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        title={isActive ? 'Sembunyikan dari publik' : 'Terbitkan'}
        className={BTN}
      >
        {isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        <span className="sr-only">{isActive ? 'Sembunyikan' : 'Terbitkan'} {title}</span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="Hapus"
        className={`${BTN} hover:text-destructive hover:bg-destructive/10`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Hapus {title}</span>
      </button>
    </div>
  )
}
