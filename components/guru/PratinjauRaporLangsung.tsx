'use client'

import { createContext, useContext, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { LembarRapor } from '@/components/rapor/LembarRapor'
import type { Blok } from '@/lib/rapor/docx'
import type { KodeMedan } from '@/lib/rapor/medan'

/**
 * Pratinjau rapor yang ikut berubah selagi guru mengetik.
 *
 * Lembarnya tetap LembarRapor yang sama dengan halaman cetak — hanya
 * datanya yang ditimpa: tulisan guru yang belum disimpan dirakit menjadi
 * `nilai` dan `isian` dengan aturan yang sama seperti pemuat data rapor
 * (timpaan kosong = hitungan sistem) dan dirapikan seperti saat disimpan.
 * Sebelum guru menyentuh apa pun, lembarnya persis hasil server.
 */

export interface DraftRapor {
  deskripsi: string
  timpaan: Record<string, string>
  isian: Record<string, string>
}

type Lapor = (draft: DraftRapor) => void

const KonteksDraft = createContext<{ draft: DraftRapor | null; lapor: Lapor } | null>(null)

/** Pembungkus kolom isian + pratinjau; tanpanya IsiRapor bekerja seperti biasa. */
export function RaporLangsung({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftRapor | null>(null)
  const nilai = useMemo(() => ({ draft, lapor: setDraft }), [draft])
  return <KonteksDraft.Provider value={nilai}>{children}</KonteksDraft.Provider>
}

/** Dipakai IsiRapor untuk mengabarkan tulisan yang belum tersimpan. */
export function useLaporDraftRapor(): Lapor | null {
  return useContext(KonteksDraft)?.lapor ?? null
}

/** Isian dirapikan seperti simpanRaporIsianAction merapikannya. */
const rapikan = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 600)

export function PratinjauRaporLangsung({
  blok, pemetaan, nilai, asli, isian, ttd, latar, riyadhoh,
}: {
  blok: Blok[]
  pemetaan: Record<string, KodeMedan>
  /** Nilai siap cetak dari server (sudah termasuk timpaan tersimpan). */
  nilai: Record<KodeMedan, string>
  /** Hitungan sistem tanpa timpaan — dasar menimpa ulang dari draft. */
  asli: Record<KodeMedan, string>
  isian: Record<string, string>
  ttd?: { pengampu: string | null; koordinator: string | null }
  latar?: Record<string, string | null>
  riyadhoh?: boolean
}) {
  const draftSegar = useContext(KonteksDraft)?.draft ?? null
  // Ketikan tetap lancar: lembar digambar ulang saat peramban sempat.
  const draft = useDeferredValue(draftSegar)

  const data = useMemo(() => {
    if (!draft) return { nilai, isian }
    const n = { ...asli }
    for (const [kode, isi] of Object.entries(draft.timpaan)) {
      const v = String(isi ?? '').trim().slice(0, 120)
      if (v !== '' && kode in n) n[kode as KodeMedan] = v
    }
    n.deskripsi = draft.deskripsi.trim()
    const i: Record<string, string> = { ...isian }
    for (const [id, isi] of Object.entries(draft.isian)) i[id] = rapikan(String(isi ?? ''))
    return { nilai: n, isian: i }
  }, [draft, nilai, asli, isian])

  return (
    <LembarRapor blok={blok} pemetaan={pemetaan} nilai={data.nilai} ttd={ttd} latar={latar} muat
      isian={data.isian} riyadhoh={riyadhoh} />
  )
}
