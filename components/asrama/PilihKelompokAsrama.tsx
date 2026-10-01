import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Pemilih kelompok asrama di Tahsin/Tahfidz Asrama — padanan PilihSesi untuk
 * halaqoh sekolah. Tidak tampil bila guru hanya mengampu satu kelompok.
 */
export function PilihKelompokAsrama({ daftar, terpilih, basePath }: {
  daftar: { id: string; nama: string }[]
  terpilih: string
  basePath: string
}) {
  if (daftar.length <= 1) return null
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih kelompok asrama">
      {daftar.map(k => (
        <Link
          key={k.id}
          href={`${basePath}?kelompok=${k.id}`}
          aria-current={k.id === terpilih ? 'page' : undefined}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition-colors',
            k.id === terpilih ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
          )}
        >
          {k.nama}
        </Link>
      ))}
    </div>
  )
}
