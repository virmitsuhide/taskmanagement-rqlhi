import Link from 'next/link'
import { FileQuestion, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NewsNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-5">
          <FileQuestion className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Berita tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Artikel mungkin sudah dihapus, dinonaktifkan, atau tautan salah.
        </p>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/news"><Newspaper className="h-3.5 w-3.5" />Lihat semua berita</Link>
        </Button>
      </div>
    </div>
  )
}
