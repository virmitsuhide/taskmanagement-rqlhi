import Link from 'next/link'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { UNIT_ORDER } from '@/lib/rq/programs'
import type { RekapIsianHalaqoh } from '@/lib/data/setoran-koor'
import { cn } from '@/lib/utils'

/**
 * Rekap "Semua guru" di /setoran: siapa yang belum mengisi Capaian Bulanan
 * (awal & akhir bulan) di semua halaqoh yang boleh dilihat — per unit, yang
 * paling belum lengkap di atas. Nama siswa yang belum diisi bisa dibuka.
 */
export function RekapIsianSemua({ rekap, periode, unit, namaBulan }: {
  rekap: RekapIsianHalaqoh[]
  periode: string
  /** Saringan unit (?unit=), null = semua unit. */
  unit: string | null
  namaBulan: string
}) {
  const unitAda = UNIT_ORDER.filter(j => rekap.some(r => r.halaqoh.jenjang === j))
  const tampil = unit ? rekap.filter(r => r.halaqoh.jenjang === unit) : rekap
  const jumlah = (f: (r: RekapIsianHalaqoh) => number) => tampil.reduce((n, r) => n + f(r), 0)
  const siswa = jumlah(r => r.siswa), awal = jumlah(r => r.awal), akhir = jumlah(r => r.akhir), lengkap = jumlah(r => r.lengkap)
  const halaqohBelum = tampil.filter(r => r.lengkap < r.siswa).length
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
  const href = (u: string | null) => `/setoran?guru=semua&periode=${periode}${u ? `&unit=${u}` : ''}`

  if (rekap.length === 0) {
    return <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">Belum ada halaqoh aktif bersiswa di unit Anda.</p>
  }

  return (
    <div className="space-y-5">
      {unitAda.length > 1 && (
        <nav aria-label="Saring unit" className="flex flex-wrap gap-1.5">
          {[null, ...unitAda].map(u => (
            <Link key={u ?? 'semua'} href={href(u)} aria-current={unit === u ? 'page' : undefined}
              className={cn('rounded-full border px-3 py-1 text-sm', unit === u ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent')}>
              {u ? JENJANG_LABELS[u as keyof typeof JENJANG_LABELS] : 'Semua unit'}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: 'Capaian awal bulan', n: awal, d: siswa },
          { l: 'Capaian akhir bulan', n: akhir, d: siswa },
          { l: 'Lengkap (awal & akhir)', n: lengkap, d: siswa },
        ].map(k => (
          <div key={k.l} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums">{pct(k.n, k.d)}%</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{k.n.toLocaleString('id-ID')} dari {k.d.toLocaleString('id-ID')} siswa</p>
          </div>
        ))}
        <div className={cn('rounded-xl border p-4', halaqohBelum ? 'border-warning/40 bg-warning-wash' : 'bg-card')}>
          <p className="text-xs text-muted-foreground">Halaqoh belum lengkap</p>
          <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums">{halaqohBelum}</p>
          <p className="mt-1 text-xs text-muted-foreground">dari {tampil.length} halaqoh · {namaBulan}</p>
        </div>
      </div>

      {UNIT_ORDER.filter(j => tampil.some(r => r.halaqoh.jenjang === j)).map(j => {
        const baris = tampil.filter(r => r.halaqoh.jenjang === j)
          .sort((a, b) => a.lengkap / a.siswa - b.lengkap / b.siswa || a.halaqoh.name.localeCompare(b.halaqoh.name, 'id', { numeric: true }))
        return (
          <section key={j} className="rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">
              {JENJANG_LABELS[j]} <span className="font-normal text-muted-foreground">· {baris.length} halaqoh</span>
            </h2>
            <ul className="divide-y">
              {baris.map(r => {
                const belum = r.lengkap < r.siswa
                return (
                  <li key={r.halaqoh.id}>
                    <details className="group">
                      <summary className={cn('grid cursor-pointer list-none grid-cols-1 gap-2 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_150px_150px_90px] sm:items-center [&::-webkit-details-marker]:hidden', !belum && 'cursor-default')}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {r.halaqoh.name}{r.halaqoh.sesi ? ` · Sesi ${r.halaqoh.sesi}` : ''}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.pengampu.map((g, i) => (
                              <span key={g.id}>
                                {i > 0 && ', '}
                                <Link href={`/setoran?guru=${g.id}&halaqoh=${r.halaqoh.id}&periode=${periode}`} className="hover:text-primary hover:underline">{g.nama}</Link>
                              </span>
                            ))}
                            {' · '}{r.siswa} siswa
                          </span>
                        </span>
                        <Bar label="Awal" n={r.awal} d={r.siswa} />
                        <Bar label="Akhir" n={r.akhir} d={r.siswa} />
                        <span className={cn('justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold sm:justify-self-end',
                          !belum ? 'bg-success-wash text-success' : r.lengkap === 0 ? 'bg-destructive-wash text-destructive' : 'bg-warning-wash text-warning')}>
                          {!belum ? 'Lengkap' : r.lengkap === 0 ? 'Belum diisi' : `${r.siswa - r.lengkap} belum`}
                        </span>
                      </summary>
                      {belum && (
                        <div className="grid gap-3 bg-muted/30 px-4 py-3 text-sm sm:grid-cols-2">
                          <Nama judul="Belum diisi awal bulan" nama={r.belumAwal} />
                          <Nama judul="Belum diisi akhir bulan" nama={r.belumAkhir} />
                        </div>
                      )}
                    </details>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Bar({ label, n, d }: { label: string; n: number; d: number }) {
  const p = d ? (n / d) * 100 : 0
  return (
    <span className="block">
      <span className="flex justify-between text-xs tabular-nums">
        <span className="text-muted-foreground">{label}</span>
        <span className={n < d ? 'font-semibold' : 'text-muted-foreground'}>{n}/{d}</span>
      </span>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${p}%`, background: 'var(--primary)' }} />
      </span>
    </span>
  )
}

function Nama({ judul, nama }: { judul: string; nama: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{judul} ({nama.length})</p>
      {nama.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Semua sudah.</p> : (
        <p className="mt-1 leading-relaxed">{nama.join(', ')}</p>
      )}
    </div>
  )
}
