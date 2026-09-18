'use client'

import { useRouter } from 'next/navigation'

/**
 * Pindah halaqoh tanpa kembali ke daftar — koordinator memeriksa belasan
 * halaqoh berturut-turut, dan bulan serta jenis yang sedang dilihat ikut
 * terbawa.
 */
export function PilihHalaqohProgres({ daftar, terpilih, query }: {
  daftar: { id: string; label: string }[]
  terpilih: string
  /** Query string yang dipertahankan, mis. "periode=2026-09&jenis=tahsin". */
  query: string
}) {
  const router = useRouter()
  return (
    <select
      value={terpilih}
      onChange={e => router.push(`/halaqoh/${e.target.value}/progres?${query}`)}
      aria-label="Pilih halaqoh"
      className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
    >
      {daftar.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
    </select>
  )
}
