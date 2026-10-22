'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pemilih tanggal pertemuan ekstra di portal guru. Begitu tanggal diganti,
 * halaman langsung memuat pertemuan itu — tanpa tombol "Buka". `href` = alamat
 * halaman tanpa parameter tanggal (sudah memuat `?`).
 */
export function TanggalPertemuan({ href, tanggal, maks, keterangan }: { href: string; tanggal: string; maks: string; keterangan?: string }) {
  const router = useRouter()
  const [memuat, mulai] = useTransition()
  return (
    <label className="mt-4 flex flex-col gap-1 text-xs font-semibold">
      Tanggal pertemuan
      <span className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          defaultValue={tanggal}
          max={maks}
          onChange={e => {
            const t = e.target.value
            // Isian setengah jadi (saat mengetik tahun) atau tanggal yang belum tiba diabaikan.
            if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t > maks) return
            mulai(() => router.push(`${href}&tanggal=${t}`, { scroll: false }))
          }}
          className="h-9 rounded-md border bg-background px-2 text-sm font-normal"
        />
        {memuat ? <span className="text-xs font-normal text-muted-foreground">Memuat…</span>
          : keterangan && <span className="text-xs font-normal text-muted-foreground">{keterangan}</span>}
      </span>
    </label>
  )
}
