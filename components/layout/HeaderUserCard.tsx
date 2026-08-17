'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, LayoutDashboard, UserRound, LogOut } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

interface Props {
  /** Sudah dalam bentuk "Ust. Habib" / "Usth. Aul". */
  name: string
  /** Label jabatan, mis. "Kepala RQ". */
  roleLabel: string
  photoUrl: string | null
  dashboardHref: string
}

/**
 * Kartu identitas di pojok kanan beranda saat pengguna sudah login —
 * menggantikan tombol "Masuk". Bagian kiri (foto + nama) menuju profil,
 * chevron di kanan membuka dropdown berisi jalan kembali ke dashboard.
 */
export function HeaderUserCard({ name, roleLabel, photoUrl, dashboardHref }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div className="flex items-center rounded-xl border bg-card shadow-sm overflow-hidden">
        <Link
          href="/profil"
          title="Buka profil"
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 hover:bg-accent transition-colors min-w-0"
        >
          <span className="h-9 w-9 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0 leading-tight text-left hidden sm:block">
            <span className="block text-[13px] font-semibold truncate">{name}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{roleLabel}</span>
          </span>
        </Link>

        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Menu akun"
          aria-expanded={open}
          aria-haspopup="menu"
          className="h-full px-2 py-2.5 border-l text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden p-1.5"
        >
          <Link
            href={dashboardHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Dashboard
          </Link>
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors"
          >
            <UserRound className="h-4 w-4 shrink-0" />
            Profil Saya
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Keluar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
