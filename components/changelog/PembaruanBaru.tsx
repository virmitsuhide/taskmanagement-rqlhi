'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'
import { kunciDibaca, LABEL_JENIS, type EntriChangelog, type PembacaChangelog } from '@/lib/rq/changelog'

/**
 * Penanda "sudah dibaca" per portal, di localStorage peramban pengguna.
 * Sengaja bukan kolom basis data: tiga jenis akun (users, teachers,
 * employees) — tiga kolom & tiga action hanya demi memadamkan sebuah kabar.
 * Bila penyimpanan ditolak, kabarnya tetap terbaca di halaman Pembaruan.
 */
const pendengar = new Set<() => void>()
function baca(p: PembacaChangelog): string | null {
  try { return window.localStorage.getItem(kunciDibaca(p)) } catch { return null }
}
function tandai(p: PembacaChangelog, iso: string) {
  try { window.localStorage.setItem(kunciDibaca(p), iso) } catch { /* ditolak: biarkan */ }
  pendengar.forEach(f => f())
}
const langgan = (f: () => void) => { pendengar.add(f); return () => { pendengar.delete(f) } }

function useDibaca(p: PembacaChangelog): string | null | undefined {
  // undefined di server & hidrasi pertama: banner belum dirender sama sekali.
  return useSyncExternalStore(langgan, () => baca(p), () => undefined)
}

/** Banner di beranda portal: pembaruan yang terbit sesudah terakhir dibaca. */
export function PembaruanBaru({ entri, pembaca, href }: { entri: EntriChangelog[]; pembaca: PembacaChangelog; href: string }) {
  const dibaca = useDibaca(pembaca)
  if (dibaca === undefined || entri.length === 0) return null
  const baru = entri.filter(e => !dibaca || e.terbit_at > dibaca)
  if (baru.length === 0) return null

  return (
    <aside className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4" aria-label="Pembaruan sistem">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {baru.length === 1 ? 'Ada pembaruan sistem' : `${baru.length} pembaruan sistem`}
        </p>
        <ul className="mt-1 space-y-0.5 text-[13px] text-muted-foreground">
          {baru.slice(0, 3).map(e => (
            <li key={e.id} className="truncate">
              <span className="font-medium text-foreground">{LABEL_JENIS[e.jenis]}:</span> {e.judul}
            </li>
          ))}
          {baru.length > 3 && <li>dan {baru.length - 3} lainnya</li>}
        </ul>
        <Link href={href} className="mt-2 inline-block text-[13px] font-semibold text-primary hover:underline">Lihat semua pembaruan</Link>
      </div>
      <button type="button" onClick={() => tandai(pembaca, baru[0].terbit_at)} aria-label="Tandai sudah dibaca"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </aside>
  )
}

/** Dipasang di halaman daftar: membukanya berarti semua yang tampil sudah dibaca. */
export function TandaiPembaruanDibaca({ pembaca, terbaru }: { pembaca: PembacaChangelog; terbaru: string | null }) {
  useEffect(() => {
    if (!terbaru) return
    const lama = baca(pembaca)
    if (!lama || terbaru > lama) tandai(pembaca, terbaru)
  }, [pembaca, terbaru])
  return null
}
