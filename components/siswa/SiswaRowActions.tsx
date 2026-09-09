'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, UserMinus } from 'lucide-react'
import { deleteStudentAction } from '@/app/actions/students'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'

/**
 * Sunting & nonaktifkan satu siswa, langsung dari barisnya di tabel.
 *
 * "Hapus" sengaja disebut NONAKTIFKAN, sebab itulah yang benar-benar terjadi:
 * deleteStudentAction menyetel is_active=false, tidak membuang barisnya. Anak
 * yang dibuang sungguhan akan menyeret riwayat setoran tahsin & tahfidz-nya
 * ikut hilang, dan riwayat itu yang jadi dasar rapor.
 *
 * Menyebutnya "Hapus" di tombol lalu menjelaskan "sebenarnya cuma nonaktif" di
 * dialog adalah cara membuat orang berhenti membaca dialog.
 */
export function SiswaRowActions({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const confirm = useConfirm()

  async function nonaktifkan() {
    const ok = await confirm({
      title: `Nonaktifkan "${name}"?`,
      description:
        'Ia hilang dari daftar kelas dan tidak bisa lagi disetorkan, tetapi ' +
        'seluruh riwayat tahsin, tahfidz, dan rapornya tetap tersimpan. ' +
        'Bisa diaktifkan lagi lewat halaman siswa.',
      confirmText: 'Nonaktifkan siswa',
    })
    if (!ok) return

    startTransition(async () => {
      const hasil = await deleteStudentAction(id)
      // Action ini redirect saat berhasil, jadi yang sampai ke sini hanya galat.
      if (hasil?.error) {
        toast.error(hasil.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="icon-sm" aria-label={`Sunting ${name}`}>
        <Link href={`/siswa/${id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
      </Button>
      <Button
        variant="ghost" size="icon-sm" disabled={pending}
        aria-label={`Nonaktifkan ${name}`}
        onClick={nonaktifkan}
        className="text-destructive hover:text-destructive"
      >
        <UserMinus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
