'use client'

import { useEffect, useRef } from 'react'
import { WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useOnline } from './useOnline'

/**
 * Pita "tidak ada koneksi" di bawah layar, untuk seluruh aplikasi.
 *
 * Halaman yang sudah terbuka TIDAK diganti layar galat — isinya tetap bisa
 * dibaca. Pita ini hanya menjelaskan apa yang masih jalan dan apa yang
 * menunggu: membaca jalan terus; menyimpan & berpindah halaman menunggu
 * koneksi. Formulir setoran & pengajuan ujian menahan pengirimannya sendiri
 * dan menyimpan isiannya di perangkat (components/formulir/useDraf.tsx).
 */
export function StatusKoneksi() {
  const online = useOnline()
  const pernahPutus = useRef(false)

  useEffect(() => {
    if (!online) pernahPutus.current = true
    else if (pernahPutus.current) {
      pernahPutus.current = false
      toast.success('Koneksi kembali', { description: 'Anda bisa menyimpan lagi.' })
    }
  }, [online])

  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] border-t bg-foreground px-4 py-3 text-background shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3 text-sm">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Tidak ada koneksi internet.</span>{' '}
          Halaman ini tetap bisa dibaca. Menyimpan dan pindah halaman menunggu koneksi kembali —
          isian setoran yang belum terkirim tetap tersimpan di perangkat ini.
        </p>
      </div>
    </div>
  )
}
