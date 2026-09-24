import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Perkakas dashboard bersama — dipakai /dashboard/analitik (manajemen) dan
 * /guru/statistik (guru), supaya keduanya berbicara dalam satu bahasa visual.
 *
 * Semuanya Server Component. Slicer & pemilih bulan berupa TAUTAN yang
 * mengganti query string, bukan state di klien: halaman tetap dirender di
 * server dengan data yang sudah tersaring, bisa dibagikan lewat URL, dan
 * tombol Back browser membatalkan filter terakhir dengan sendirinya.
 */

// ─── Tata letak ──────────────────────────────────────────────────────────────

/**
 * Baris atas pola Z: judul di kiri (titik mulai mata), filter di kanan
 * (ujung garis atas). Di HP keduanya menumpuk, judul tetap lebih dulu.
 */
export function DashTop({ eyebrow, title, context, filters, serif = false }: {
  eyebrow: string
  title: string
  /** Cakupan & periode yang sedang dibaca — wajib, angka tanpa periode tak bisa diverifikasi. */
  context: React.ReactNode
  filters: React.ReactNode
  serif?: boolean
}) {
  return (
    // Container query, bukan breakpoint layar: yang menentukan adalah lebar
    // KONTEN setelah sidebar dikurangi. Dengan lg: (layar ≥1024px) judul dan
    // tiga filter dipaksa sebaris di ruang ±960px, filter terlipat dua baris
    // dan judul melayang di bawah baris pertamanya. Kini keduanya baru
    // berdampingan bila wadahnya ≥80rem; di bawah itu filter jadi satu baris
    // rapi di bawah judul.
    <div className="@container">
      <div className="flex flex-col gap-4 @[80rem]:flex-row @[80rem]:items-end @[80rem]:justify-between">
        <div className="min-w-0 @[80rem]:shrink-0">
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">{eyebrow}</p>
          <h1
            className={cn('text-2xl leading-tight', serif ? 'font-extrabold tracking-tight' : 'font-bold')}
            style={serif ? { fontFamily: 'var(--font-playfair), Georgia, serif' } : undefined}
          >
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{context}</p>
        </div>
        {/* min-w-0: tanpa ini lebar minimum item flex = lebar isinya, sehingga
            slicer panjang (mis. 12 jenis rapat) melebarkan halaman alih-alih
            digeser di dalam slicer-nya sendiri. */}
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3 @[80rem]:justify-end">{filters}</div>
      </div>
    </div>
  )
}

export function Panel({ title, icon, sub, action, children, className, id }: {
  title: string
  icon?: React.ReactNode
  sub?: React.ReactNode
  action?: { href: string; label: string }
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('min-w-0 rounded-xl border bg-card p-5 scroll-mt-4', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action && (
          <Link href={action.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Pemisah antar-kelompok blok, mis. "Periode ini" vs "Kondisi hari ini". */
export function GroupLabel({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[1.8px] text-muted-foreground">{children}</h2>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

// ─── Filter ──────────────────────────────────────────────────────────────────

export interface SlicerOption {
  label: string
  href: string
  active: boolean
  /** Angka kecil di belakang label, mis. jumlah siswa unit itu. */
  count?: number
}

/**
 * Slicer: kelompok tombol bersegmen. Di HP yang sempit digeser mendatar,
 * bukan dibungkus ke baris baru — baris tombol yang terlipat sulit dipindai.
 */
export function Slicer({ label, options }: { label: string; options: SlicerOption[] }) {
  return (
    <div className="min-w-0 max-w-full">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{label}</p>
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg border bg-muted p-0.5">
          {options.map(o => (
            <Link
              key={o.href}
              href={o.href}
              scroll={false}
              aria-current={o.active ? 'true' : undefined}
              className={cn(
                'whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
                o.active
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
              {o.count !== undefined && <span className="ml-1 tabular-nums opacity-60">{o.count.toLocaleString('id-ID')}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Pemilih bulan ‹ Agustus 2026 ›. Batas rentang = tautan dinonaktifkan. */
export function MonthStepper({ label, current, prevHref, nextHref }: {
  label: string
  current: string
  prevHref: string | null
  nextHref: string | null
}) {
  const tombol = 'flex h-7 w-7 items-center justify-center rounded-md transition-colors'
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{label}</p>
      <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5">
        {prevHref
          ? <Link href={prevHref} scroll={false} aria-label="Bulan sebelumnya" className={cn(tombol, 'hover:bg-card')}><ChevronLeft className="h-4 w-4" /></Link>
          : <span aria-hidden className={cn(tombol, 'opacity-30')}><ChevronLeft className="h-4 w-4" /></span>}
        <span className="min-w-[8.5rem] rounded-md bg-card px-2 py-1 text-center text-xs font-semibold shadow-sm">{current}</span>
        {nextHref
          ? <Link href={nextHref} scroll={false} aria-label="Bulan berikutnya" className={cn(tombol, 'hover:bg-card')}><ChevronRight className="h-4 w-4" /></Link>
          : <span aria-hidden className={cn(tombol, 'opacity-30')}><ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  )
}

/** Susun URL dari parameter saat ini dengan satu nilai diganti; nilai bawaan dibuang dari URL. */
export function hrefDengan(
  path: string,
  params: Record<string, string | undefined>,
  ganti: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...params, ...ganti })) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

/** Persen perubahan; null bila pembandingnya nol — bagi nol tidak bermakna. */
export function persenUbah(dari: number, ke: number): number | null {
  return dari === 0 ? null : Math.round(((ke - dari) / dari) * 100)
}

export type NadaKpi = 'destructive' | 'warning' | 'success'

// Literal, bukan `text-${tone}`: Tailwind hanya membangkitkan kelas yang tertulis utuh di sumber.
const TEKS_NADA: Record<NadaKpi, string> = { destructive: 'text-destructive', warning: 'text-warning', success: 'text-success' }

export function KpiCard({ label, value, unit, icon, sub, delta, ratio, href, tone, ratioTone }: {
  label: string
  value: string | number
  /** Satuan kecil di belakang angka, mis. "/ 120". */
  unit?: string
  icon?: React.ReactNode
  /** Satu baris konteks di bawah angka. */
  sub?: React.ReactNode
  /** Perubahan terhadap periode pembanding. */
  delta?: { pct: number | null; vs: string }
  /** 0..1 — digambar sebagai bar tipis; untuk KPI yang berupa bagian dari keseluruhan. */
  ratio?: number
  /** Kartu menjadi tautan ke tempat angka itu diurus. */
  href?: string
  /**
   * Warna STATUS angka — hanya bila angkanya memang menuntut tindakan
   * (mis. tugas terlambat > 0). Angka biasa tetap warna teks.
   */
  tone?: NadaKpi
  /** Warna isi bar rasio bila ambangnya bermakna (kelengkapan < 60% dst.). */
  ratioTone?: NadaKpi
}) {
  const isi = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon && <span className={tone ? TEKS_NADA[tone] : 'text-primary'}>{icon}</span>}
        <span className="line-clamp-2 leading-snug">{label}</span>
        {href && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className={cn('mt-2 text-2xl font-bold leading-none tabular-nums', tone && TEKS_NADA[tone])}>
        {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {ratio !== undefined && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{
            width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
            background: ratioTone ? `var(--${ratioTone})` : 'var(--primary)',
          }} />
        </div>
      )}
      <div className="mt-auto pt-2 space-y-0.5">
        {delta && <Delta pct={delta.pct} vs={delta.vs} />}
        {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
      </div>
    </>
  )
  const kelas = 'group flex flex-col rounded-xl border bg-card p-4'
  return href
    ? <Link href={href} className={cn(kelas, 'transition-colors hover:border-primary/40 hover:bg-muted/30')}>{isi}</Link>
    : <div className={kelas}>{isi}</div>
}

export function Delta({ pct, vs }: { pct: number | null; vs: string }) {
  if (pct === null) {
    // Pembandingnya nol: persen tak bermakna, jadi cukup sebut rentangnya.
    return <p className="truncate text-[11px] text-muted-foreground">— vs {vs} (nihil)</p>
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const tone = pct > 0 ? 'text-success' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'
  return (
    <p className="flex items-center gap-1 text-[11px]">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', tone)} />
      <span className={cn('font-semibold tabular-nums', tone)}>{pct > 0 ? '+' : ''}{pct.toLocaleString('id-ID')}%</span>
      <span className="truncate text-muted-foreground">vs {vs}</span>
    </p>
  )
}

// ─── Bagian dari keseluruhan ─────────────────────────────────────────────────

export interface Segmen {
  label: string
  value: number
  /** Token status (var(--success) dsb.) — segmen ini memang status, bukan seri. */
  color: string
  icon?: React.ReactNode
}

/**
 * Bar bertumpuk 100% dengan legenda bernilai. Warna tidak pernah sendirian:
 * tiap segmen punya ikon, angka, dan persen di legenda.
 */
export function StackedBar({ segments, satuan = 'siswa' }: { segments: Segmen[]; satuan?: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">Belum ada {satuan} yang terukur.</p>
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img"
        aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {segments.map(s => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: s.color }}>
              {s.icon ?? <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />}
            </span>
            <span className="flex-1">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value.toLocaleString('id-ID')}</span>
            <span className="w-10 text-right tabular-nums text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Baris tindak lanjut: angka besar + keterangan + tautan ke tempat mengurusnya. */
export function ActionRow({ count, label, href, tone = 'warning' }: {
  count: number
  label: string
  href: string
  tone?: 'warning' | 'destructive' | 'muted'
}) {
  const warna = count === 0 ? 'var(--muted-foreground)' : tone === 'muted' ? 'var(--muted-foreground)' : `var(--${tone})`
  const latar = count === 0 || tone === 'muted' ? 'var(--muted)' : `var(--${tone}-wash)`
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <span className="flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums"
        style={{ background: latar, color: warna }}>
        {count.toLocaleString('id-ID')}
      </span>
      <span className="flex-1 text-xs leading-snug">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
