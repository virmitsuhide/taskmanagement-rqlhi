'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicPost } from '@/types'

/**
 * Lonceng pengumuman Portal Guru.
 *
 * Sengaja lebih sederhana daripada lonceng pengurus: guru tidak menandai
 * pengumuman satu per satu, dan tidak ada tindakan yang perlu diambil dari
 * dalam laci ini. Lencananya padam saat berandanya dibuka — bukan saat
 * loncengnya diklik — sebab berandalah tempat isinya benar-benar terbaca.
 */

const NADA: Record<string, string> = {
  penting: 'text-destructive',
  pengingat: 'text-warning',
  info: 'text-primary',
}

function sejakKapan(iso: string): string {
  const menit = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari === 1) return 'kemarin'
  if (hari < 7) return `${hari} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function PengumumanBell({ items, barusanCount }: { items: PublicPost[]; barusanCount: number }) {
  const [open, setOpen] = useState(false)
  const wadah = useRef<HTMLDivElement>(null)

  // Tutup saat menekan di luar atau menekan Esc — laci tanpa jalan keluar yang
  // jelas gampang menjebak pemakai keyboard.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={barusanCount > 0 ? `Pengumuman, ${barusanCount} baru` : 'Pengumuman'}
        aria-expanded={open}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {barusanCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {barusanCount > 9 ? '9+' : barusanCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Pengumuman</p>
            {barusanCount > 0 && (
              <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                {barusanCount} baru
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Belum ada pengumuman.
            </p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {items.map(p => (
                <li key={p.id}>
                  <Link
                    href={`/pengumuman/${p.id}`}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <p className={cn('text-xs font-medium', NADA[p.priority ?? 'info'] ?? 'text-primary')}>
                      {p.type === 'tugas_guru' ? 'Tugas Guru' : 'Pengumuman'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm">{p.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{sejakKapan(p.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/guru"
            onClick={() => setOpen(false)}
            className="block border-t px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Lihat semua di beranda
          </Link>
        </div>
      )}
    </div>
  )
}
