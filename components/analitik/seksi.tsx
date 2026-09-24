import { HEADER_STICKY_TOP } from '@/components/layout/DashboardHeader'
import { cn } from '@/lib/utils'

/**
 * Kerangka halaman analitik tunggal — gaya "halaman laporan" ala dashboard BI:
 * satu kanvas panjang, dibelah menjadi seksi bernomor, dengan pita navigasi
 * yang parkir di bawah header seperti tab halaman laporan.
 *
 * Tiap seksi memakai pola Z yang sama:
 *
 *   ① nomor + judul + pertanyaan ─────────► ② angka kunci (strip KPI)
 *                        ╱
 *   ③ visual utama (lebar) ───────────────► ④ panel pendukung / tindak lanjut
 *
 * Seragamnya kerangka ini yang membuat halaman panjang tetap mudah dipindai:
 * mata tahu di mana mencari angka, dan di mana mencari "apa yang harus
 * dikerjakan".
 */

export interface InfoSeksi {
  id: string
  nomor: number
  label: string
}

/** Pita navigasi seksi — tautan jangkar biasa, tanpa JavaScript. */
export function SeksiNav({ seksi }: { seksi: InfoSeksi[] }) {
  return (
    <nav
      aria-label="Seksi analitik"
      className={cn('sticky z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur md:-mx-6 md:px-6 print:hidden', HEADER_STICKY_TOP)}
    >
      <ol className="-mb-px flex gap-1 overflow-x-auto">
        {seksi.map(s => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className="flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold tabular-nums"
                style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
                {s.nomor}
              </span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Satu seksi laporan: kepala Z (judul ◄► angka kunci), lalu isinya. */
export function Seksi({ info, judul, pertanyaan, catatan, kunci, children }: {
  info: InfoSeksi
  judul: string
  /** Pertanyaan yang dijawab seksi ini — satu kalimat. */
  pertanyaan: string
  /** Cakupan/periode seksi, bila berbeda dari filter halaman. */
  catatan?: React.ReactNode
  /** Strip angka kunci di kanan kepala seksi. */
  kunci?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={info.id} className="scroll-mt-[140px] space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      {/* Container query, sama dengan DashTop: di ruang konten ±960px (layar
          1280 dikurangi sidebar) empat angka kunci tidak muat di samping
          judul — mereka terlipat dan menyeret judul turun. Berdampingan
          hanya bila wadahnya memang cukup lebar. */}
      <div className="@container">
      <div className="flex flex-col gap-3 @[72rem]:flex-row @[72rem]:items-end @[72rem]:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            {info.nomor}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">{judul}</h2>
            <p className="text-xs text-muted-foreground">
              {pertanyaan}
              {catatan && <> · {catatan}</>}
            </p>
          </div>
        </div>
        {kunci && <div className="grid grid-cols-2 gap-2 @md:flex @md:flex-wrap @[72rem]:justify-end">{kunci}</div>}
      </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Angka kunci mini di kepala seksi — lebih ringkas dari KpiCard, supaya
 * kepala seksi tetap satu baris di desktop.
 */
export function Kunci({ label, nilai, nada = 'netral' }: {
  label: string
  nilai: React.ReactNode
  nada?: 'netral' | 'baik' | 'waspada' | 'bahaya'
}) {
  const warna = nada === 'baik' ? 'var(--success)' : nada === 'waspada' ? 'var(--warning)' : nada === 'bahaya' ? 'var(--destructive)' : 'var(--foreground)'
  return (
    <div className="min-w-[96px] rounded-lg border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight tabular-nums" style={{ color: warna }}>{nilai}</p>
    </div>
  )
}

/** Kerangka pengganti selama seksi dimuat. */
export function SeksiMemuat({ info, judul }: { info: InfoSeksi; judul: string }) {
  return (
    <section id={info.id} className="scroll-mt-[140px] space-y-4 border-t pt-6" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground">{info.nomor}</span>
        <h2 className="text-lg font-bold text-muted-foreground">{judul}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="h-56 animate-pulse rounded-xl bg-muted/60 lg:col-span-8" />
        <div className="h-56 animate-pulse rounded-xl bg-muted/60 lg:col-span-4" />
      </div>
    </section>
  )
}
