'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'
import { deleteTeacherAction, restoreTeacherAction } from '@/app/actions/teachers'
import { Button } from '@/components/ui/button'

/**
 * Hapus akun guru. Hapusnya lunak — akun disembunyikan, bukan dibuang, dan
 * bisa dipulihkan dari tab Terhapus. Konfirmasinya menyebut nama guru supaya
 * tidak ada akun yang hilang karena salah baris, dan menyebut apa yang tetap
 * aman supaya admin tidak ragu menekan tombolnya.
 */
export function DeleteTeacherButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    const ok = confirm(
      `Hapus akun guru "${name}"?\n\n` +
      'Guru langsung kehilangan akses login dan hilang dari semua daftar. ' +
      'Riwayat setoran dan penugasan halaqoh-nya tetap tersimpan, dan akun ini ' +
      'bisa dipulihkan lagi dari tab Terhapus.',
    )
    if (!ok) return

    startTransition(async () => {
      const result = await deleteTeacherAction(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Akun ${name} dihapus`)
      router.push('/ustadz')
    })
  }

  return (
    <Button
      type="button" size="sm" variant="outline" disabled={pending}
      onClick={handleDelete}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5 mr-1" />
      {pending ? 'Menghapus…' : 'Hapus'}
    </Button>
  )
}

/** Kembalikan akun guru yang terhapus, beserta status aktifnya semula. */
export function RestoreTeacherButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreTeacherAction(id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Akun ${name} dipulihkan`)
      router.refresh()
    })
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleRestore}>
      <RotateCcw className="h-3.5 w-3.5 mr-1" />
      {pending ? 'Memulihkan…' : 'Pulihkan'}
    </Button>
  )
}
