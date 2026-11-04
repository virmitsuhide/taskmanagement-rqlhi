'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertCircle, Copy, Home, RotateCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/components/formulir/useOnline'

/**
 * Layar galat bersama untuk error.tsx di tiap wilayah.
 *
 * Menjawab tiga hal yang ditanyakan orang di depan layar galat:
 *   · APA yang terjadi   — halaman gagal dimuat (atau koneksinya putus)
 *   · SALAH SIAPA        — koneksi, atau sistem; tidak pernah penggunanya
 *   · LALU BAGAIMANA     — coba lagi; bila berulang, kirim kodenya ke admin
 *
 * Kode galat (digest) bisa disalin sekali ketuk — admin mencarinya di log
 * server, dan mengetik ulang 10 digit acak dari HP hampir pasti keliru.
 */
export function HalamanGalat({ error, reset, beranda = '/', layarPenuh = true }: {
  error: Error & { digest?: string }
  reset: () => void
  beranda?: string
  layarPenuh?: boolean
}) {
  const online = useOnline()
  const [tersalin, setTersalin] = useState(false)

  useEffect(() => {
    console.error('[HalamanGalat]', error)
  }, [error])

  async function salin() {
    try {
      await navigator.clipboard.writeText(`Kode error RQ LHI: ${error.digest} · ${window.location.pathname}`)
      setTersalin(true)
    } catch { /* clipboard ditolak — kodenya tetap terlihat untuk disalin manual */ }
  }

  return (
    <div className={`flex items-center justify-center bg-background px-6 py-12 ${layarPenuh ? 'min-h-screen' : 'min-h-[60vh]'}`}>
      <div className="w-full max-w-md text-center">
        <div className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full ${online ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {online ? <AlertCircle className="h-7 w-7" /> : <WifiOff className="h-7 w-7" />}
        </div>

        {online ? (
          <>
            <h1 className="mb-2 text-3xl tracking-tight">Halaman ini gagal dimuat</h1>
            <p className="text-sm text-muted-foreground">
              Ini gangguan di sistem kami, <span className="font-medium text-foreground">bukan karena yang Anda lakukan</span>.
              Data yang sudah tersimpan sebelumnya tetap aman.
            </p>
            <ol className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-muted-foreground">
              <li>1. Tekan <span className="font-medium text-foreground">Coba lagi</span> — gangguan sesaat biasanya sudah pulih.</li>
              <li>2. Bila masih gagal, kirim kode di bawah ini ke admin RQ.</li>
            </ol>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-3xl tracking-tight">Koneksi internet terputus</h1>
            <p className="text-sm text-muted-foreground">
              Halaman ini butuh internet untuk dimuat. Tidak ada yang rusak — sambungkan
              lagi Wi-Fi atau data seluler, lalu tekan Coba lagi.
            </p>
          </>
        )}

        {online && error.digest && (
          <button
            type="button"
            onClick={salin}
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
            {tersalin ? 'Kode tersalin' : `Kode: ${error.digest}`}
          </button>
        )}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => reset()} size="sm" className="gap-1.5" disabled={!online}>
            <RotateCw className="h-3.5 w-3.5" />
            {online ? 'Coba lagi' : 'Menunggu koneksi…'}
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={beranda}>
              <Home className="h-3.5 w-3.5" />
              Kembali ke beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
