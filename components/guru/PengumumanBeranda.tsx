'use client'

import Link from 'next/link'
import { Megaphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sembunyikanKartu, useKartuTersembunyi } from './kartu-tersembunyi'
import type { PublicPost } from '@/types'

const RUANG = 'pengumuman'

const NADA: Record<string, string> = {
  penting: 'text-destructive',
  pengingat: 'text-warning',
  info: 'text-primary',
}

/**
 * Pengumuman di beranda guru, sebagai kartu yang bisa ditutup.
 *
 * Kartunya membuka pengumuman; tombol ✕ menghilangkannya dari beranda untuk
 * seterusnya. Sengaja tanpa "tampilkan lagi": pengumuman yang sudah ditutup
 * masih bisa dibaca lewat lonceng, jadi beranda tidak perlu menyimpan jalan
 * pulang untuknya. Bagian ini lenyap sepenuhnya saat semua kartu ditutup —
 * tidak ada gunanya kotak kosong bertuliskan "Pengumuman".
 */
export function PengumumanBeranda({ teacherId, items, barusanCount, tersembunyiAwal }: {
  teacherId: string
  items: PublicPost[]
  barusanCount: number
  /** Kartu yang sudah ditutup guru ini, dari server — berlaku di semua perangkat. */
  tersembunyiAwal: string[]
}) {
  const tersembunyi = useKartuTersembunyi(RUANG, teacherId, tersembunyiAwal)
  const tampil = items.filter(p => !tersembunyi.has(p.id))
  if (tampil.length === 0) return null

  return (
    <section className="mb-6 rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Pengumuman</h2>
        {barusanCount > 0 && (
          <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            {barusanCount} baru
          </span>
        )}
      </div>

      <ul className="grid gap-3 p-3 sm:grid-cols-2">
        {tampil.map(pos => (
          <li key={pos.id} className="relative">
            <Link
              href={`/guru/pengumuman/${pos.id}`}
              className="block h-full rounded-lg border bg-background p-3 pr-9 transition-colors hover:border-primary hover:bg-accent/40"
            >
              <p className={cn('text-[11px] font-medium', NADA[pos.priority ?? 'info'] ?? 'text-primary')}>
                {pos.type === 'tugas_guru' ? 'Tugas Guru' : 'Pengumuman'}
                {pos.due_date ? ` · tenggat ${pos.due_date}` : ''}
              </p>
              <p className="mt-0.5 text-sm font-medium">{pos.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{pos.content}</p>
            </Link>
            {/* Tombol di luar tautan: tombol di dalam <a> tidak sah dan klik
                ✕ akan ikut membuka pengumumannya. */}
            <button
              type="button"
              onClick={() => sembunyikanKartu(RUANG, teacherId, pos.id)}
              aria-label={`Tutup pengumuman ${pos.title}`}
              title="Hilangkan dari beranda"
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
