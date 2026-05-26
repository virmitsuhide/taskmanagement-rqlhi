'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function NewsError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[NewsError]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h2 className="text-lg font-bold mb-1">Berita gagal dimuat</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Terjadi kesalahan saat mengambil daftar berita.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground/70 mb-4">{error.digest}</p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} size="sm" className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            Coba lagi
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/"><Home className="h-3.5 w-3.5" />Beranda</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
