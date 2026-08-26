'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { History, ListChecks, PlusCircle, UserCheck } from 'lucide-react'

const MENU = [
  { href: '/ujian/kelola',  label: 'Kelola',  icon: ListChecks },
  { href: '/ujian/ajukan',  label: 'Ajukan',  icon: PlusCircle },
  { href: '/ujian/riwayat', label: 'Riwayat', icon: History    },
  { href: '/ujian/penguji', label: 'Penguji', icon: UserCheck  },
]

/**
 * Navigasi antar halaman modul ujian di sisi pengurus.
 *
 * Bentuknya sama dengan tab publik dan tab /tentang — garis bawah tipis, bukan
 * tombol berlatar, supaya perpindahan antar halaman terasa seperti berpindah
 * bagian dalam satu layar, bukan membuka menu baru.
 */
export function UjianSubNav() {
  const pathname = usePathname()

  return (
    <div className="border-b -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav aria-label="Menu ujian" className="flex gap-1 min-w-fit">
        {MENU.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
