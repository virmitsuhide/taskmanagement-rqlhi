import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronRight, Minus } from 'lucide-react'
import { monthName } from '@/lib/finance/period'
import { labelTahap, type KartuHalaqoh as DataKartu, type MetrikHalaqoh, type TitikHalaqoh } from '@/lib/data/analitik-halaqoh'
import { AvatarGuru } from './AvatarGuru'
import { TitikPekan, type TitikPekanData } from './TitikPekan'
import { cn } from '@/lib/utils'

export const LABEL_METRIK: Record<MetrikHalaqoh, string> = {
  tahsin: 'Tahsin / bulan',
  tahfidz: 'Tahfidz / bulan',
  jilid: 'Rata-rata jilid',
  hafalan: 'Rata-rata hafalan',
}

/** Angka & satuan sebuah metrik untuk dibaca manusia. */
export function teksMetrik(m: MetrikHalaqoh, v: number | null): string {
  if (v === null) return '—'
  if (m === 'jilid') {
    // Jilid 1–6 punya nomor, jadi rata-ratanya bisa dibaca "Jilid 3,4";
    // di luar itu (Pra, Al-Qur'an, Gharib, …) cukup tahap terdekatnya.
    return v >= 1 && v < 7 ? `Jilid ${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}` : labelTahap(v)
  }
  const angka = v.toLocaleString('id-ID', { maximumFractionDigits: m === 'hafalan' ? 2 : 1 })
  return m === 'hafalan' ? `${angka} juz` : `${angka} hlm`
}

const nilai = (t: TitikHalaqoh | undefined, m: MetrikHalaqoh) => (t ? t[m] : null)

/**
 * Peringkat semua kartu pada satu indeks bulan. Halaqoh tanpa angka
 * (tidak berlaku / belum ada data) tidak diberi peringkat.
 */
export function peringkat(kartu: DataKartu[], m: MetrikHalaqoh, i: number): Map<string, number> {
  const urut = kartu
    .filter(k => nilai(k.titik[i], m) !== null)
    .sort((a, b) => nilai(b.titik[i], m)! - nilai(a.titik[i], m)!)
  const hasil = new Map<string, number>()
  urut.forEach((k, n) => {
    // Nilai sama = peringkat sama.
    const sebelum = urut[n - 1]
    hasil.set(k.id, sebelum && nilai(sebelum.titik[i], m) === nilai(k.titik[i], m) ? hasil.get(sebelum.id)! : n + 1)
  })
  return hasil
}

/** Metrik aliran (per bulan) — bulan berjalan tidak dibandingkan dengan bulan penuh. */
export const metrikAliran = (m: MetrikHalaqoh) => m === 'tahsin' || m === 'tahfidz'

export function Selisih({ m, kini, lalu, berjalan }: { m: MetrikHalaqoh; kini: number | null; lalu: number | null; berjalan: boolean }) {
  // Aliran bulan berjalan tidak dibandingkan dengan bulan penuh — selalu tampak anjlok.
  if (berjalan && metrikAliran(m)) return <span className="text-muted-foreground">bulan berjalan</span>
  if (kini === null || lalu === null) return <span className="text-muted-foreground">belum ada pembanding</span>
  const d = Math.round((kini - lalu) * 100) / 100
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus
  const nada = d > 0 ? 'text-success' : d < 0 ? 'text-destructive' : 'text-muted-foreground'
  const satuan = m === 'jilid' ? ' tahap' : m === 'hafalan' ? ' juz' : ' hlm'
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', nada)}>
      <Icon className="h-3 w-3" aria-hidden />
      {d > 0 ? '+' : ''}{d.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{satuan}
    </span>
  )
}

/**
 * Garis tren kecil satu metrik selama jendela bulan, dengan garis rata-rata
 * unit (oranye putus-putus) sebagai pembanding. Bulan tanpa data tidak
 * digambar (bukan titik nol); ruas ke bulan berjalan putus-putus.
 */
function GarisTren({ titik, m, berjalan, rataUnit }: {
  titik: TitikHalaqoh[]; m: MetrikHalaqoh; berjalan: boolean; rataUnit?: (number | null)[]
}) {
  const L = 220, T = 48, pad = 5
  const vs = titik.map(t => t[m])
  const ada = vs.filter((v): v is number => v !== null)
  if (ada.length < 2) {
    return <p className="text-[11px] text-muted-foreground">Tren muncul setelah ada data dua bulan.</p>
  }
  const rv = (rataUnit ?? []).filter((v): v is number => v !== null)
  const semua = [...ada, ...rv]
  const min = Math.min(...semua), max = Math.max(...semua)
  const x = (i: number) => pad + (i * (L - 2 * pad)) / (titik.length - 1)
  const y = (v: number) => max === min ? T / 2 : T - pad - ((v - min) / (max - min)) * (T - 2 * pad)
  const ruas: { d: string; putus: boolean }[] = []
  for (let i = 1; i < vs.length; i++) {
    const a = vs[i - 1], b = vs[i]
    if (a === null || b === null) continue
    ruas.push({ d: `M${x(i - 1)},${y(a)}L${x(i)},${y(b)}`, putus: berjalan && i === vs.length - 1 })
  }
  const garisRata = (rataUnit ?? [])
    .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .filter((p): p is string => p !== null)
  const ringkas = `${LABEL_METRIK[m]}: ${titik.map(t => `${monthName(t.bulan).slice(0, 3)} ${teksMetrik(m, t[m])}`).join(', ')}`
  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${L} ${T}`} className="h-12 w-full" preserveAspectRatio="none" role="img" aria-label={ringkas}>
        {garisRata.length >= 2 && (
          <polyline points={garisRata.join(' ')} stroke="var(--accent-warm, var(--warning))" strokeWidth="1.5" fill="none"
            strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        )}
        {ruas.map((r, i) => (
          <path key={i} d={r.d} stroke="var(--primary)" strokeWidth="2" fill="none"
            strokeDasharray={r.putus ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
        ))}
        {vs.map((v, i) => v !== null && (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === vs.length - 1 ? 3.2 : 2.2} fill="var(--primary)" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground" aria-hidden>
        {titik.map(t => <span key={t.bulan}>{monthName(t.bulan).slice(0, 3)}</span>)}
      </div>
    </div>
  )
}

export interface TambahanKartu {
  /** Rata-rata unit per titik untuk metrik terpilih — garis pembanding. */
  rataUnit?: (number | null)[]
  /** Persen hadir bulan itu; null = belum ada presensi. */
  hadir?: number | null
  /** Target TAHFIDZ: anak sesuai/di atas target dari yang terukur. */
  target?: { sesuai: number; terukur: number } | null
  pekan?: TitikPekanData[]
  href?: string
}

export function KartuHalaqoh({ k, metrik, rank, rankLalu, berjalan, tambahan = {} }: {
  k: DataKartu
  metrik: MetrikHalaqoh
  rank: number | undefined
  rankLalu: number | undefined
  berjalan: boolean
  tambahan?: TambahanKartu
}) {
  const kini = k.titik.at(-1)!
  const lalu = k.titik.at(-2)
  const naik = rank !== undefined && rankLalu !== undefined ? rankLalu - rank : null
  const lain = (['tahsin', 'tahfidz', 'jilid', 'hafalan'] as MetrikHalaqoh[]).filter(m => m !== metrik)
  const drillAnak = kini.drillJilid.anak + kini.drillJuz.anak
  const { hadir, target, pekan, href } = tambahan

  const isi = (
    <>
      <header className="flex items-start gap-3">
        <AvatarGuru gender={k.guru?.gender ?? null} label={k.guru?.nama} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{k.guru?.nama ?? 'Belum ada wali halaqoh'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {k.nama} · {k.siswa.toLocaleString('id-ID')} siswa{k.sesi ? ` · sesi ${k.sesi}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {rank !== undefined ? (
            <>
              <p className="font-heading text-xl leading-none tabular-nums">#{rank}</p>
              {naik !== null && naik !== 0 && (
                <p className={cn('mt-1 inline-flex items-center text-[11px] font-semibold', naik > 0 ? 'text-success' : 'text-destructive')}>
                  {naik > 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                  {Math.abs(naik)}<span className="sr-only"> peringkat {naik > 0 ? 'naik' : 'turun'}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] leading-tight text-muted-foreground">tanpa<br />peringkat</p>
          )}
        </div>
      </header>

      {!kini.adaData ? (
        <p className="mt-4 text-sm text-muted-foreground">Belum ada setoran tercatat di bulan ini.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-4">
            <div>
              <p className="text-[11px] leading-tight text-muted-foreground">{LABEL_METRIK[metrik]}</p>
              <p className="mt-1 font-heading text-2xl leading-none tabular-nums">
                {kini[metrik] === null && metrik === 'tahsin' ? <span className="text-sm text-muted-foreground">tidak berlaku</span> : teksMetrik(metrik, kini[metrik])}
              </p>
              <p className="mt-1 text-[11px]"><Selisih m={metrik} kini={kini[metrik]} lalu={lalu ? lalu[metrik] : null} berjalan={berjalan} /></p>
            </div>
            <GarisTren titik={k.titik} m={metrik} berjalan={berjalan} rataUnit={tambahan.rataUnit} />
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            {lain.map((m, i) => (
              <span key={m}>{i > 0 && ' · '}{LABEL_METRIK[m].replace(' / bulan', '').replace('Rata-rata ', '')}{' '}
                <b className="font-semibold text-foreground tabular-nums">{teksMetrik(m, kini[m])}</b></span>
            ))}
          </p>

          <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Hadir</dt>
              <dd className={cn('font-bold tabular-nums', hadir !== null && hadir !== undefined && hadir < 85 && 'text-destructive')}>
                {hadir === null || hadir === undefined ? '—' : `${hadir}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground" title="Target tahfidz per hari ini">Sesuai target</dt>
              <dd className="font-bold tabular-nums">{target && target.terukur > 0 ? `${target.sesuai}/${target.terukur}` : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Drill</dt>
              <dd className="font-bold tabular-nums" title={`Drill jilid ${kini.drillJilid.anak} anak · drill juz ${kini.drillJuz.anak} anak`}>
                {drillAnak.toLocaleString('id-ID')} anak
              </dd>
            </div>
          </dl>
        </>
      )}

      {(pekan || href) && (
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {pekan ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Laporan per pekan</span>
              <TitikPekan pekan={pekan} />
            </div>
          ) : <span />}
          {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
        </div>
      )}
    </>
  )

  const kelas = 'group flex min-w-0 flex-col rounded-2xl border bg-card p-4'
  return href ? (
    <Link href={href}
      className={cn(kelas, 'transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary')}>
      {isi}
    </Link>
  ) : <article className={kelas}>{isi}</article>
}
