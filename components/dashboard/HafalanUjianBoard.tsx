import Link from 'next/link'
import { ScrollText } from 'lucide-react'

import { ringkasHafalan } from '@/lib/rq/hafalan'
import type { HafalanUjianUnit } from '@/lib/data/analytics'

/**
 * Capaian hafalan yang sudah lulus ujian, per unit.
 *
 * Berdampingan dengan papan hafalan dari setoran, bukan menggantikannya.
 * Setoran adalah proses harian; ujian adalah yang sudah diakui tuntas. Selisih
 * antara keduanya justru informasi yang dicari — anak yang setorannya sudah
 * jauh tapi belum pernah diujikan.
 */
export function HafalanUjianBoard({ units, tampilTeratas = true }: {
  units: HafalanUjianUnit[]
  /** false bila halaman sudah punya papan peringkat hafalan sendiri — hindari daftar ganda. */
  tampilTeratas?: boolean
}) {
  if (units.length === 0) {
    return (
      <section>
        <h2 className="font-heading text-lg font-medium mb-1">Hafalan Lulus Ujian</h2>
        <div className="rounded-xl border border-dashed py-10 text-center">
          <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Belum ada catatan ujian yang terhubung ke data siswa.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Catatan lama perlu dipasangkan lebih dulu lewat{' '}
            <Link href="/ujian/pemetaan" className="underline underline-offset-2">
              Ujian &rsaquo; Pemetaan
            </Link>
            .
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-heading text-lg font-medium mb-1">Hafalan Lulus Ujian</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Dihitung dari catatan ujian yang selesai, memakai urutan hafalan
        30&ndash;26 lalu 1&ndash;25. Satu catatan sudah menyimpulkan juz-juz
        sebelumnya.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {units.map(u => {
          const maxSebaran = Math.max(1, ...u.sebaran.map(s => s.siswa))
          return (
            <div key={u.jenjang} className="rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{u.label}</p>
                <p className="text-xs text-muted-foreground">
                  {u.siswaTeruji} siswa &middot; rata-rata {u.rataJuz} juz
                </p>
              </div>

              <div className="mt-3 space-y-1">
                {u.sebaran.map(s => (
                  <div key={s.juz} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {s.juz} juz
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(s.siswa / maxSebaran) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {s.siswa}
                    </span>
                  </div>
                ))}
              </div>

              {tampilTeratas && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Terbanyak
                </p>
                <ol className="space-y-1">
                  {u.top10.slice(0, 5).map((s, i) => (
                    <li key={s.id} className="flex items-baseline gap-2 text-sm">
                      <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {i + 1}.
                      </span>
                      <Link href={`/siswa/${s.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {s.name}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground" title={ringkasHafalan(s.juz)}>
                        {s.juz} juz
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
