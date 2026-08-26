'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatTanggal } from '@/lib/rq/ujian'
import { createPengujiAction, deletePengujiAction } from '@/app/actions/ujian'
import type { UjianPenguji } from '@/types'

export function PengujiManager({ pengujis }: { pengujis: UjianPenguji[] }) {
  const router = useRouter()
  const [nama, setNama] = useState('')
  const [error, setError] = useState('')
  const [hapus, setHapus] = useState<UjianPenguji | null>(null)
  const [pending, startTransition] = useTransition()

  function tambah(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const hasil = await createPengujiAction(nama)
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      setNama('')
      router.refresh()
    })
  }

  function konfirmasiHapus() {
    if (!hapus) return
    startTransition(async () => {
      const hasil = await deletePengujiAction(hapus.id)
      setHapus(null)
      if (hasil.error) setError(hasil.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={tambah} className="space-y-2 rounded-xl border bg-card p-4">
        <label htmlFor="nama-penguji" className="text-sm font-medium">
          Tambah nama penguji
        </label>
        <div className="flex gap-2">
          <Input
            id="nama-penguji"
            className="h-9"
            value={nama}
            onChange={e => setNama(e.target.value)}
            placeholder="Contoh: Ust. Nuha"
          />
          <Button type="submit" size="lg" disabled={pending}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Tambah
          </Button>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Daftar ini yang muncul saat koordinator memilih penguji ketika menjadwalkan ujian.
          Dipakai bersama SD dan SMP.
        </p>
      </form>

      {pengujis.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm font-medium">Belum ada penguji terdaftar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tambahkan nama agar bisa dipilih saat menjadwalkan ujian.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pengujis.map(p => (
            <li key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.nama}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ditambahkan {formatTanggal(p.created_at)}
                </p>
              </div>
              <Button
                variant="ghost" size="icon-sm"
                aria-label={`Hapus ${p.nama}`}
                onClick={() => setHapus(p)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(hapus)} onOpenChange={open => !open && setHapus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus penguji?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{hapus?.nama}</span> tidak akan muncul
              lagi saat menjadwalkan ujian. Riwayat ujian yang sudah tercatat atas namanya tetap
              utuh — nama penguji disimpan sebagai teks pada tiap ujian.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1"
              onClick={() => setHapus(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant="destructive" size="lg" className="flex-1"
              onClick={konfirmasiHapus} disabled={pending}>
              {pending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
