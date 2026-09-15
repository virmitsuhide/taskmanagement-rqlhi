'use client'

import { useRouter } from 'next/navigation'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'

/**
 * Pemilih sesi/halaqoh di halaman setoran per sesi. Berpindah lewat query
 * string (?halaqoh=…) supaya daftar anaknya dimuat ulang di server dan tautan
 * ke sesi tertentu bisa disimpan guru.
 */
export function PilihSesi({ daftar, terpilih, basePath }: {
  daftar: HalaqohSesi[]
  terpilih: string
  basePath: string
}) {
  const router = useRouter()
  if (daftar.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih sesi">
      {daftar.map(h => {
        const aktif = h.id === terpilih
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => router.push(`${basePath}?halaqoh=${h.id}`)}
            aria-pressed={aktif}
            className={
              'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
              (aktif ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent')
            }
          >
            {h.sesi ? `Sesi ${h.sesi}` : h.name}
          </button>
        )
      })}
    </div>
  )
}
