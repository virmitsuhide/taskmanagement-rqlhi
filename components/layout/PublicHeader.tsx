import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-bold shadow-sm">
            RQ
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm">Rumah Qur&apos;an LHI</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Banguntapan · Bantul
            </p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="#program" className="hover:text-foreground transition">Program</Link>
          <Link href="#" className="hover:text-foreground transition">Pengumuman</Link>
          <Link href="#" className="hover:text-foreground transition">Tentang</Link>
        </nav>

        <Button asChild size="sm" className="rounded-full">
          <Link href="/login">
            Masuk <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
