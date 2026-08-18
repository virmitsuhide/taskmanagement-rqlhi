'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'
import { deleteTaskAction, restoreTaskAction } from '@/app/actions/tasks'
import { Button } from '@/components/ui/button'

interface Props {
  taskId: string
  title: string
  canEdit: boolean
  canDelete: boolean
  /** Tugas sedang terhapus — tampilkan tombol pulihkan (khusus manajemen). */
  isDeleted?: boolean
  canRestore?: boolean
}

/**
 * Tombol sunting / hapus / pulihkan di halaman detail tugas.
 *
 * Sengaja tidak menyembunyikan dirinya sendiri berdasar role — halaman yang
 * menghitung izinnya lewat canEditTask/canDeleteTask, komponen ini hanya
 * menerima hasilnya. Server tetap memeriksa ulang di action.
 */
export function TaskRowActions({ taskId, title, canEdit, canDelete, isDeleted, canRestore }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(
      `Hapus tugas "${title}"?\n\n` +
      'Tugas disembunyikan dari daftar & papan, tapi riwayat dan diskusinya ' +
      'tetap tersimpan dan masih bisa dipulihkan oleh manajemen. ' +
      'Manajemen akan menerima notifikasi penghapusan ini.',
    )) return

    startTransition(async () => {
      // Sukses berujung redirect ke /tasks, jadi hanya kegagalan yang kembali.
      const result = await deleteTaskAction(taskId)
      if (result?.error) toast.error(result.error)
    })
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreTaskAction(taskId)
      if (result?.error) toast.error(result.error)
      else { toast.success('Tugas dipulihkan'); router.refresh() }
    })
  }

  if (isDeleted) {
    if (!canRestore) return null
    return (
      <Button type="button" size="sm" variant="outline" onClick={handleRestore} disabled={pending}>
        <RotateCcw className="h-4 w-4 mr-1" />
        {pending ? 'Memulihkan...' : 'Pulihkan Tugas'}
      </Button>
    )
  }

  if (!canEdit && !canDelete) return null

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/tasks/${taskId}/edit`}><Pencil className="h-4 w-4 mr-1" />Sunting</Link>
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={pending}
          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {pending ? 'Menghapus...' : 'Hapus'}
        </Button>
      )}
    </div>
  )
}
