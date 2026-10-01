'use client'

import { useRouter } from 'next/navigation'

/**
 * Pilih guru di halaman /setoran. Bulan dan jenis yang sedang dilihat ikut
 * terbawa; sesi sengaja dilepas, karena tiap guru punya halaqohnya sendiri.
 */
export function PilihGuruSetoran({ daftar, terpilih, query }: {
  daftar: { id: string; nama: string; jumlahSesi: number }[]
  terpilih: string
  /** Query string yang dipertahankan, mis. "periode=2026-09&jenis=tahsin". */
  query: string
}) {
  const router = useRouter()
  return (
    <select
      value={terpilih}
      onChange={e => router.push(`/setoran?guru=${e.target.value}&${query}`)}
      aria-label="Pilih guru"
      className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
    >
      {daftar.map(g => (
        <option key={g.id} value={g.id}>
          {g.nama}{g.jumlahSesi > 1 ? ` (${g.jumlahSesi} sesi)` : ''}
        </option>
      ))}
    </select>
  )
}
