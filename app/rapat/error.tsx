'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RapatError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[RapatError]', error)
  }, [error])

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-3" />
        <h2 className="font-semibold mb-1">Rapat gagal dimuat</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Terjadi kesalahan saat mengambil data rapat.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground/70 mb-3">{error.digest}</p>
        )}
        <Button onClick={reset} size="sm" variant="outline" className="gap-1.5">
          <RotateCw className="h-3.5 w-3.5" />
          Coba lagi
        </Button>
      </div>
    </div>
  )
}
