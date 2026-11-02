'use client'

import { useRouter } from 'next/navigation'

/**
 * Pilih guru di halaman /setoran (dan /ekstra/setoran). Bulan dan jenis yang
 * sedang dilihat ikut terbawa; sesi/halaqoh sengaja dilepas, karena tiap guru
 * punya halaqohnya sendiri. "Semua guru" membuka tabel setoran seluruh halaqoh.
 */
export function PilihGuruSetoran({ daftar, terpilih, query, basePath = '/setoran', satuan = 'sesi' }: {
  daftar: { id: string; nama: string; jumlahSesi: number }[]
  terpilih: string
  /** Query string yang dipertahankan, mis. "periode=2026-09&jenis=tahsin". */
  query: string
  basePath?: string
  /** Kata untuk jumlah halaqoh di belakang nama, mis. "sesi" atau "halaqoh". */
  satuan?: string
}) {
  const router = useRouter()
  return (
    <select
      value={terpilih}
      onChange={e => router.push(`${basePath}?guru=${e.target.value}${query ? `&${query}` : ''}`)}
      aria-label="Pilih guru"
      className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm"
    >
      <option value="semua">Semua guru</option>
      {daftar.map(g => (
        <option key={g.id} value={g.id}>
          {g.nama}{g.jumlahSesi > 1 ? ` (${g.jumlahSesi} ${satuan})` : ''}
        </option>
      ))}
    </select>
  )
}
