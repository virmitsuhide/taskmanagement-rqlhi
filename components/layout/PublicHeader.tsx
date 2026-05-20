import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            RQ
          </div>
          <span className="font-semibold text-sm">Rumah Qur'an LHI</span>
        </Link>
        <Button asChild size="sm">
          <Link href="/login">Masuk</Link>
        </Button>
      </div>
    </header>
  )
}
