import { Timer } from 'lucide-react'
import type { DrillTahfidzAnalitik, StatLama } from '@/lib/data/analytics'

const BATAS_SEDANG = 10

function hari(n: number | null): string {
  return n === null ? '—' : `${n.toLocaleString('id-ID')} hari`
}

/**
 * Drill tahfidz: berapa lama anak menyiapkan ujian 1 juz.
 *
 * Tiga pertanyaan, tiga blok: berapa lama biasanya (keseluruhan), juz mana
 * yang paling lama disiapkan (per juz), dan siapa yang sedang menunggu paling
 * lama tanpa pengajuan (daftar sedang drill).
 */
export function DrillTahfidzBoard({ data, showUnit = true }: { data: DrillTahfidzAnalitik; showUnit?: boolean }) {
  const { keseluruhan: k, perJuz, perUnit, sedang } = data
  const maxRata = Math.max(1, ...perJuz.map(j => j.rata ?? 0))

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Timer className="h-4 w-4" /> Persiapan Ujian 1 Juz (Drill Tahfidz)
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Dihitung dari tanggal ziyadah satu juz tuntas (seluruh ayatnya pernah disetor) sampai tanggal
        ujian 1 juz-nya diajukan.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Sedang drill" nilai={sedang.length.toLocaleString('id-ID')} ket="juz belum diajukan" />
        <Kpi label="Rata-rata persiapan" nilai={hari(k.rata)} ket={k.n > 0 ? `dari ${k.n} juz diajukan` : 'belum ada data'} />
        <Kpi label="Median" nilai={hari(k.median)} ket="separuh anak lebih cepat" />
        <Kpi label="Rentang" nilai={k.n > 0 ? `${k.tercepat}–${k.terlama}` : '—'} ket="hari tercepat–terlama" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Rata-rata lama persiapan per juz</p>
          {perJuz.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada juz yang diajukan ujiannya setelah ziyadahnya tuntas.
            </p>
          ) : (
            <div className="space-y-1.5">
              {perJuz.map(j => (
                <div key={j.juz} className="flex items-center gap-2" title={ringkas(j)}>
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">Juz {j.juz}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${((j.rata ?? 0) / maxRata) * 100}%`, background: 'var(--primary)' }} />
                  </div>
                  <span className="w-24 shrink-0 text-[11px] tabular-nums">
                    {hari(j.rata)} <span className="text-muted-foreground">· {j.n} anak</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {showUnit && perUnit.length > 1 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Per unit</p>
              <ul className="space-y-1 text-xs">
                {perUnit.map(u => (
                  <li key={u.jenjang} className="flex justify-between gap-2">
                    <span>{u.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      rata-rata {hari(u.rata)} · median {hari(u.median)} · {u.n} juz
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Sedang drill, terlama menunggu</p>
          {sedang.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada juz yang sedang menunggu diajukan.</p>
          ) : (
            <ul className="divide-y">
              {sedang.slice(0, BATAS_SEDANG).map(s => (
                <li key={s.id} className="flex items-center gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{s.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Juz {s.juz}{s.kelas ? ` · ${s.kelas}` : ''}{s.halaqoh ? ` · ${s.halaqoh}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums font-medium">{s.hari} hari</span>
                </li>
              ))}
            </ul>
          )}
          {sedang.length > BATAS_SEDANG && (
            <p className="mt-2 text-[11px] text-muted-foreground">+{sedang.length - BATAS_SEDANG} juz lainnya.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function ringkas(s: StatLama): string {
  return `Rata-rata ${hari(s.rata)}, median ${hari(s.median)}, tercepat ${hari(s.tercepat)}, terlama ${hari(s.terlama)} (${s.n} anak)`
}

function Kpi({ label, nilai, ket }: { label: string; nilai: string; ket: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold leading-none">{nilai}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{ket}</p>
    </div>
  )
}
