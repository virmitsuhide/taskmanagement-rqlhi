'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookMarked, CornerDownLeft, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Palet pencarian Ctrl/⌘ K untuk ruang pengurus.
 *
 * Daftar halamannya DIBACA dari menu samping yang sudah dirender
 * (nav[aria-label="Navigasi utama"]), bukan disalin ke sini. Menu itu sudah
 * menyaring halaman menurut izin jabatan, jadi palet tidak pernah menawarkan
 * halaman yang tidak boleh dibuka — dan tak ada daftar kedua yang harus
 * dijaga tetap sama.
 *
 * Selain halaman, ada dua jalan pintas pencarian: siswa dan halaqoh, memakai
 * pencarian ?q= yang sudah ada di kedua daftar itu.
 */

interface Item {
  href: string
  label: string
  grup: string
  ikon?: React.ReactNode
}

export const BUKA_PALET = 'buka-palet-perintah'

function kumpulkanMenu(): Item[] {
  const nav = document.querySelector('nav[aria-label="Navigasi utama"]')
  if (!nav) return []
  const hasil: Item[] = []
  const dilihat = new Set<string>()
  nav.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach(a => {
    const href = a.getAttribute('href')!
    const label = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').replace(/\d+$/, '').trim()
    if (!label || dilihat.has(href)) return
    dilihat.add(href)
    // Judul kelompok menu = teks judul terdekat sebelum tautan ini, bila ada.
    const kelompok = a.closest('[data-grup]')?.getAttribute('data-grup') ?? 'Halaman'
    hasil.push({ href, label, grup: kelompok })
  })
  return hasil
}

export function PaletPerintah() {
  const router = useRouter()
  const [buka, setBuka] = useState(false)
  const [q, setQ] = useState('')
  const [aktif, setAktif] = useState(0)
  const [menu, setMenu] = useState<Item[]>([])
  const input = useRef<HTMLInputElement>(null)

  const bukaPalet = useCallback(() => {
    setMenu(kumpulkanMenu())
    setQ('')
    setAktif(0)
    setBuka(true)
  }, [])

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (buka) setBuka(false)
        else bukaPalet()
      }
    }
    window.addEventListener('keydown', tombol)
    window.addEventListener(BUKA_PALET, bukaPalet)
    return () => {
      window.removeEventListener('keydown', tombol)
      window.removeEventListener(BUKA_PALET, bukaPalet)
    }
  }, [buka, bukaPalet])

  useEffect(() => {
    if (buka) setTimeout(() => input.current?.focus(), 0)
  }, [buka])

  const hasil = useMemo<Item[]>(() => {
    const kata = q.trim().toLowerCase()
    const cocok = kata
      ? menu.filter(m => m.label.toLowerCase().includes(kata) || m.grup.toLowerCase().includes(kata))
      : menu
    const ada = (p: string) => menu.some(m => m.href === p || m.href.startsWith(`${p}?`))
    const cari: Item[] = []
    if (kata) {
      if (ada('/siswa')) cari.push({ href: `/siswa?q=${encodeURIComponent(q.trim())}`, label: `Cari siswa “${q.trim()}”`, grup: 'Cari', ikon: <Users className="h-4 w-4" /> })
      if (ada('/halaqoh')) cari.push({ href: `/halaqoh?q=${encodeURIComponent(q.trim())}`, label: `Cari halaqoh “${q.trim()}”`, grup: 'Cari', ikon: <BookMarked className="h-4 w-4" /> })
    }
    return [...cocok.slice(0, 12), ...cari]
  }, [q, menu])

  function pergi(item: Item | undefined) {
    if (!item) return
    setBuka(false)
    router.push(item.href)
  }

  if (!buka) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={e => { if (e.target === e.currentTarget) setBuka(false) }}
      role="dialog"
      aria-modal="true"
      aria-label="Cari halaman"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={input}
            value={q}
            onChange={e => { setQ(e.target.value); setAktif(0) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAktif(a => Math.min(a + 1, hasil.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif(a => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); pergi(hasil[aktif]) }
              else if (e.key === 'Escape') setBuka(false)
            }}
            placeholder="Cari halaman, siswa, atau halaqoh…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Kata kunci"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {hasil.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada halaman yang cocok.</li>
          )}
          {hasil.map((item, i) => (
            <li key={`${item.grup}-${item.href}`} role="option" aria-selected={i === aktif}>
              <button
                onMouseEnter={() => setAktif(i)}
                onClick={() => pergi(item)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                  i === aktif ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
                )}
              >
                <span className="text-primary">{item.ikon ?? <ArrowRight className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.label}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.grup}</span>
                {i === aktif && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Tombol "Cari · Ctrl K" untuk bilah atas. */
export function TombolCari() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(BUKA_PALET))}
      className="hidden h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
      aria-label="Cari (Ctrl K)"
    >
      <Search className="h-4 w-4" />
      <span>Cari</span>
      <kbd className="ml-3 rounded border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
    </button>
  )
}
