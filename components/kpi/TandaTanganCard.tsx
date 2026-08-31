'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { TandaTanganField } from './TandaTanganField'
import { Button } from '@/components/ui/button'
import type { SignatureFocus } from '@/types'

type Aksi = (
  state: unknown,
  formData: FormData,
) => Promise<{ error: string } | { success: true }>

interface Props {
  aksi: Aksi
  src: string | null
  fokus: SignatureFocus
  nama: string
  /** Kalimat yang menjelaskan untuk apa tanda tangannya dipakai. */
  keterangan: string
}

/**
 * Kartu tanda tangan di halaman profil — pengurus maupun guru.
 *
 * Berdiri sebagai formulir sendiri, tidak menumpang form profil besar di
 * atasnya. Alasannya berkas: mengunggah gambar mengubah bentuk pengiriman
 * seluruh formulir, dan menggabungkannya berarti tiap penyimpanan profil ikut
 * memikul unggahan yang mungkin gagal sendiri. Terpisah, kegagalan mengunggah
 * tanda tangan tidak pernah membatalkan penyimpanan riwayat pendidikan
 * seseorang.
 */
export function TandaTanganCard({ aksi, src, fokus, nama, keterangan }: Props) {
  const [state, formAction, pending] = useActionState(aksi, null)

  return (
    <form action={formAction} className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Tanda Tangan</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{keterangan}</p>

      <TandaTanganField src={src} initial={fokus} nama={nama} />

      {state && 'error' in state && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Tanda tangan tersimpan. Rapor yang sudah terbit tidak ikut berubah — hanya rapor
          yang Anda tandatangani setelah ini yang memakai gambar baru.
        </p>
      )}

      <Button type="submit" size="sm" className="mt-3" disabled={pending}>
        Simpan Tanda Tangan
      </Button>
    </form>
  )
}
