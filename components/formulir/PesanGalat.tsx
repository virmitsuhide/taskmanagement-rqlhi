'use client'

import { apakahSesiBerakhir } from '@/lib/auth/pesan'

/**
 * Pesan galat formulir. Untuk sesi yang berakhir, pesannya disertai jalan
 * keluar yang TIDAK membuang isian: masuk lagi di tab baru, kembali ke tab
 * ini, lalu tekan Simpan sekali lagi. Cookie sesi berlaku untuk semua tab.
 */
export function PesanGalat({ pesan, portal = 'guru', className }: {
  pesan: string | null | undefined
  portal?: 'guru' | 'pengurus'
  className?: string
}) {
  if (!pesan) return null
  const login = portal === 'guru' ? '/guru/login' : '/login'

  return (
    <div role="alert" className={className ?? 'rounded-xl bg-destructive-wash px-4 py-3 text-sm text-destructive'}>
      <p className="font-medium">{pesan}</p>
      {apakahSesiBerakhir(pesan) && (
        <p className="mt-1 text-foreground">
          Isian Anda masih di layar ini.{' '}
          <a href={login} target="_blank" rel="noopener" className="font-semibold text-primary underline underline-offset-2">
            Masuk lagi di tab baru
          </a>
          , lalu kembali ke sini dan tekan Simpan sekali lagi.
        </p>
      )}
    </div>
  )
}
