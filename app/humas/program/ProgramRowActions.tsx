'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Eye, EyeOff, Trash2, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { toggleProgramAction, deleteProgramAction, moveProgramAction } from '@/app/actions/program'

interface Props {
  slug: string
  title: string
  isActive: boolean
  isFirst: boolean
  isLast: boolean
}

const BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none'

export function ProgramRowActions({ slug, title, isActive, isFirst, isLast }: Props) {
  const [pending, startTransition] = useTransition()

  function move(direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveProgramAction(slug, direction)
      if (result?.error) toast.error(result.error)
    })
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleProgramAction(slug, !isActive)
      if (result?.error) toast.error(result.error)
      else toast.success(isActive ? 'Program disembunyikan' : 'Program ditampilkan')
    })
  }

  function handleDelete() {
    if (!confirm(`Hapus program "${title}"? Seluruh isi halaman detailnya ikut terhapus dan tidak bisa dikembalikan.`)) return
    startTransition(async () => {
      const result = await deleteProgramAction(slug)
      if (result?.error) toast.error(result.error)
      else toast.success('Program dihapus')
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Geser urutan */}
      <div className="flex flex-col mr-1">
        <button
          type="button" onClick={() => move('up')}
          disabled={pending || isFirst} title="Naikkan urutan"
          className="inline-flex h-4 w-6 items-center justify-center rounded-t border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronUp className="h-3 w-3" />
          <span className="sr-only">Naikkan {title}</span>
        </button>
        <button
          type="button" onClick={() => move('down')}
          disabled={pending || isLast} title="Turunkan urutan"
          className="inline-flex h-4 w-6 items-center justify-center rounded-b border border-t-0 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronDown className="h-3 w-3" />
          <span className="sr-only">Turunkan {title}</span>
        </button>
      </div>

      <Link href={`/program/${slug}`} target="_blank" title="Lihat di halaman publik" className={BTN}>
        <ExternalLink className="h-3.5 w-3.5" />
        <span className="sr-only">Lihat {title}</span>
      </Link>
      <Link href={`/humas/program/${slug}/edit`} title="Edit" className={BTN}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Edit {title}</span>
      </Link>
      <button
        type="button" onClick={handleToggle} disabled={pending}
        title={isActive ? 'Sembunyikan dari publik' : 'Tampilkan'}
        className={BTN}
      >
        {isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        <span className="sr-only">{isActive ? 'Sembunyikan' : 'Tampilkan'} {title}</span>
      </button>
      <button
        type="button" onClick={handleDelete} disabled={pending}
        title="Hapus"
        className={`${BTN} hover:text-destructive hover:bg-destructive/10`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Hapus {title}</span>
      </button>
    </div>
  )
}
