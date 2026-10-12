import Link from 'next/link'
import { ChevronRight, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Pintu ke halaman Tampilan dari profil karyawan — portal itu tidak punya sidebar. */
export function TautanTampilan({ href, className }: { href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-wash text-primary">
        <Palette className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Tampilan · ganti suasana</span>
        <span className="block text-xs text-muted-foreground">Warna ruang kerja, mode gelap, dan ukuran teks</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
