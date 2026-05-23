import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV = [
  { label: 'Beranda',    href: '/'        },
  { label: 'Tugas',      href: '#tugas'   },
  { label: 'News',       href: '/news'    },
  { label: 'Program',    href: '#program' },
  { label: 'Tentang RQ', href: '#tentang' },
]

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-5xl mx-auto flex h-[58px] items-center gap-7 px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-auto shrink-0">
          <div className="h-[38px] w-[38px] rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shadow-sm shrink-0">
            ج
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[15px] tracking-[-0.3px]">Rumah Qur&apos;an LHI</p>
            <p className="text-[9px] uppercase tracking-[0.8px] text-muted-foreground">
              Web App RQ LHI · Banguntapan
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(n => (
            <Link
              key={n.label}
              href={n.href}
              className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Button asChild size="sm" className="shrink-0">
          <Link href="/login">
            Masuk <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
