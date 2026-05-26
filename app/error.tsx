'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertCircle, Home, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-5">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Sesuatu yang tidak terduga terjadi saat memuat halaman ini.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 mb-6">
            Kode error: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => reset()} size="sm" className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            Coba lagi
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/">
              <Home className="h-3.5 w-3.5" />
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
