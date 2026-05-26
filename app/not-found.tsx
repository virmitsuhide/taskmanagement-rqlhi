import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-5">
          <FileQuestion className="h-7 w-7" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          404
        </p>
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tautan yang kamu buka mungkin sudah dipindahkan atau dihapus.
        </p>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/">
            <Home className="h-3.5 w-3.5" />
            Kembali ke Beranda
          </Link>
        </Button>
      </div>
    </div>
  )
}
