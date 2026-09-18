'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PublicNavItem {
  label: string
  href: string
  children?: { label: string; href: string; description: string }[]
}

/**
 * Menu halaman publik untuk layar sempit.
 *
 * Di desktop menu tampil sebagai baris tautan dengan dropdown hover. Hover
 * tidak ada di HP, jadi di sini submenu tidak disembunyikan di balik ketukan
 * kedua: induk dan anak-anaknya langsung terlihat, anak menjorok di bawah
 * induknya. Isi menunya datang dari PublicHeader lewat props supaya daftar
 * desktop dan HP tidak pernah berbeda.
 */
export function PublicMobileNav({ items }: { items: PublicNavItem[] }) {
  const pathname = usePathname()
  // Menu mengingat di halaman mana ia dibuka. Pindah halaman — termasuk lewat
  // tombol kembali peramban, yang tidak melewati onClick tautan mana pun —
  // otomatis menutupnya, tanpa efek yang harus menyetel ulang state.
  const [dibukaDi, setDibukaDi] = useState<string | null>(null)
  const open = dibukaDi === pathname
  const setOpen = (buka: boolean | ((o: boolean) => boolean)) =>
    setDibukaDi(typeof buka === 'function' ? (buka(open) ? pathname : null) : buka ? pathname : null)
  const panelId = useId()
  const tombolRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const tombol = tombolRef.current
    const sebelumnya = document.body.style.overflow
    // Halaman di belakang panel tidak ikut tergulung saat jari menggulir menu.
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDibukaDi(null) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = sebelumnya
      document.removeEventListener('keydown', onKey)
      tombol?.focus()
    }
  }, [open])

  const aktif = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <div className="md:hidden">
      <button
        ref={tombolRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Latar — mengetuk di luar panel menutup menu. Dimulai di bawah header
              supaya tombol tutup tetap terlihat dan bisa diketuk. */}
          <div className="fixed inset-x-0 bottom-0 top-[58px] z-40 bg-black/40" onClick={() => setOpen(false)} aria-hidden />

          <nav
            id={panelId}
            aria-label="Menu utama"
            className="fixed inset-x-0 top-[58px] z-50 max-h-[calc(100dvh-58px)] overflow-y-auto border-b bg-background px-4 pb-5 pt-2 shadow-lg"
          >
            <ul className="space-y-0.5">
              {items.map(item => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={aktif(item.href) && !item.children ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-3 text-[15px] font-medium transition-colors hover:bg-accent',
                      aktif(item.href) && !item.children && 'bg-primary/10 text-primary',
                    )}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <ul className="mb-1 ml-3 space-y-0.5 border-l pl-2">
                      {item.children.map(child => (
                        <li key={child.href + child.label}>
                          <Link
                            href={child.href}
                            onClick={() => setOpen(false)}
                            aria-current={pathname === child.href ? 'page' : undefined}
                            className={cn(
                              'block rounded-lg px-3 py-2 transition-colors hover:bg-accent',
                              pathname === child.href && 'bg-primary/10 text-primary',
                            )}
                          >
                            <span className="block text-sm font-medium">{child.label}</span>
                            <span className="block text-xs leading-snug text-muted-foreground">{child.description}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  )
}
