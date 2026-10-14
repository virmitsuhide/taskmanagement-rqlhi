import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohGuru, type HalaqohGuru, type NadaLencana } from '@/lib/data/halaqoh-guru'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string }>
}

const angka = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })

/**
 * Halaqoh saya — ringkasan satu halaqoh untuk gurunya, dirancang untuk ponsel.
 * Statistik lengkap (periode, peringkat) tetap di /guru/statistik.
 */
export default async function HalaqohSayaPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const d = await getHalaqohGuru(session.teacherId, sp.halaqoh)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 md:px-6 md:py-6">
        <header className="flex items-center gap-2">
          <Link href="/guru/statistik" aria-label="Kembali ke Statistik"
            className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold leading-tight">Halaqoh saya</h1>
            <p className="truncate text-xs text-muted-foreground">
              Statistik · {session.fullName}{d.terpilih ? ` · ${d.jumlahSiswa} siswa` : ''}
            </p>
          </div>
        </header>

        {d.halaqoh.length > 1 && (
          <nav aria-label="Pilih halaqoh" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {d.halaqoh.map(h => {
              const aktif = d.terpilih?.id === h.id
              return (
                <Link key={h.id} href={`/guru/halaqoh-saya?halaqoh=${h.id}`} aria-current={aktif ? 'page' : undefined}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors',
                    aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent',
                  )}>
                  {h.nama}
                </Link>
              )
            })}
          </nav>
        )}

        {!d.terpilih ? (
          <Kosong teks="Anda belum mengampu halaqoh aktif." />
        ) : d.jumlahSiswa === 0 ? (
          <Kosong teks="Halaqoh ini belum berisi siswa aktif." />
        ) : (
          <Isi d={d} />
        )}
      </div>
    </div>
  )
}

function Kosong({ teks }: { teks: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 py-10 text-center text-sm text-muted-foreground">{teks}</div>
  )
}

function Isi({ d }: { d: HalaqohGuru }) {
  const delta = (n: number | null) =>
    n === null || n === 0 ? null : (
      <span className={n > 0 ? 'text-success' : 'text-accent-warm'}>{n > 0 ? '▲' : '▼'} {angka(Math.abs(n))}</span>
    )

  return (
    <>
      {/* Ringkasan satu kalimat */}
      <section className="rounded-2xl px-5 py-4" style={{ background: 'var(--sidebar)', color: 'var(--sidebar-foreground)' }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'color-mix(in oklab, var(--accent-warm) 55%, white)' }}>
          {d.namaBulan} · sejauh ini
        </p>
        <p className="mt-1 font-heading text-xl leading-snug md:text-2xl">
          {d.ringkasan.awal} <i>{d.ringkasan.tegas}</i>
        </p>
      </section>

      {/* Empat angka */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Hadir" nilai={d.hadir.persen === null ? '—' : `${d.hadir.persen}%`}
          sub={d.hadir.persen === null ? 'belum ada absensi bulan ini' : 'bulan ini'} />
        <Tile label="Tahsin" nilai={d.tahsin.nilai === null ? '—' : `${angka(d.tahsin.nilai)} hlm`}
          sub={<>per anak{delta(d.tahsin.delta) && <> · {delta(d.tahsin.delta)}</>}</>} />
        <Tile label="Tahfidz" warna="warm" nilai={d.tahfidz.nilai === null ? '—' : `${angka(d.tahfidz.nilai)} hlm`}
          sub={<>ziyadah per anak{delta(d.tahfidz.delta) && <> · {delta(d.tahfidz.delta)}</>}</>} />
        <Tile label="Target tahfidz" warna="netral"
          nilai={d.target.terukur === 0 ? '—' : `${d.target.sesuai}/${d.target.terukur}`}
          sub={d.target.terukur === 0 ? 'belum terukur' : d.target.diBawah > 0 ? `sesuai · ${d.target.diBawah} di bawah` : 'semua sesuai target'} />
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">
        Tahsin = halaman lulus, tahfidz = halaman ziyadah, jalur sekolah. Panah membandingkan dengan {d.pembanding}.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Laju tahsin 6 bulan */}
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-bold">Laju tahsin {d.laju.length} bulan</h2>
          <p className="text-[11px] text-muted-foreground">Halaman lulus per anak, per bulan.</p>
          <Sparkline d={d} />
          <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span aria-hidden className="inline-block w-5 border-t-2 border-dotted" style={{ borderColor: 'var(--accent-warm)' }} />
            Rata-rata {d.jumlahHalaqohPembanding} halaqoh {d.labelPembanding}.
          </p>
        </section>

        {/* Perlu dibantu */}
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-bold">Perlu dibantu pekan ini</h2>
          <p className="text-[11px] text-muted-foreground">Drill &gt; 14 hari, di bawah target tahfidz, tidak setor &gt; 5 hari, atau siap diuji.</p>
          {d.perluDibantu.length === 0 ? (
            <p className="mt-3 rounded-lg p-3 text-sm" style={{ background: 'var(--success-wash)', color: 'var(--success)' }}>
              <Check className="mr-1 inline h-4 w-4" />Tidak ada anak yang perlu dibantu khusus pekan ini.
            </p>
          ) : (
            <ul className="mt-2 divide-y border-t">
              {d.perluDibantu.map(p => (
                <li key={p.id}>
                  <Link href={`/guru/siswa/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/30">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{p.nama}</b>
                      {p.detail && <span className="block text-xs text-muted-foreground">{p.detail}</span>}
                      {p.lain.length > 0 && <span className="block text-[11px] text-muted-foreground">juga: {p.lain.join(', ').toLowerCase()}</span>}
                    </span>
                    <Lencana nada={p.nada}>{p.lencana}</Lencana>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function Tile({ label, nilai, sub, warna = 'primary' }: {
  label: string
  nilai: string
  sub: React.ReactNode
  warna?: 'primary' | 'warm' | 'netral'
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-heading text-[26px] leading-tight tabular-nums',
        warna === 'primary' ? 'text-primary' : warna === 'warm' ? 'text-accent-warm' : 'text-foreground')}>
        {nilai}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

const NADA: Record<NadaLencana, string> = {
  warm: 'bg-accent-warm-wash text-accent-warm',
  destructive: 'bg-destructive-wash text-destructive',
  success: 'bg-success-wash text-success',
}

function Lencana({ nada, children }: { nada: NadaLencana; children: React.ReactNode }) {
  return <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-bold', NADA[nada])}>{children}</span>
}

/** Garis 6 bulan — SVG murni. Segmen ke bulan berjalan putus-putus (belum genap). */
function Sparkline({ d }: { d: HalaqohGuru }) {
  const W = 320, H = 80, PAD = 6
  const n = d.laju.length
  const semua = d.laju.flatMap(t => [t.nilai, t.rataRata]).filter((v): v is number => v !== null)
  if (semua.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">Belum ada setoran tahsin dalam {n} bulan terakhir.</p>
  }
  const maks = Math.max(1, ...semua)
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, n - 1)
  const y = (v: number) => H - PAD - (v / maks) * (H - 2 * PAD)
  const segmen = (pilih: (i: number) => number | null) =>
    d.laju.slice(1).flatMap((_, k) => {
      const a = pilih(k), b = pilih(k + 1)
      return a === null || b === null ? [] : [{ k, x1: x(k), y1: y(a), x2: x(k + 1), y2: y(b) }]
    })
  const akhir = n - 1
  const terakhirBerjalan = d.laju[akhir]?.bulan === d.hariIni.slice(0, 7)

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Laju tahsin: ${d.laju.map(t => `${t.label} ${t.nilai === null ? 'tanpa data' : angka(t.nilai)}`).join(', ')}`}>
        {segmen(i => d.laju[i].rataRata).map(s => (
          <line key={`r${s.k}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--accent-warm)" strokeWidth={1.2} strokeDasharray="2 3" />
        ))}
        {segmen(i => d.laju[i].nilai).map(s => (
          <line key={`n${s.k}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--primary)" strokeWidth={2}
            strokeDasharray={terakhirBerjalan && s.k + 1 === akhir ? '4 3' : undefined} />
        ))}
        {d.laju.map((t, i) => t.nilai === null ? null : (
          <circle key={t.bulan} cx={x(i)} cy={y(t.nilai)} r={i === akhir ? 3.2 : 2.2} fill="var(--primary)">
            <title>{`${t.label}: ${angka(t.nilai)} hlm/anak${t.rataRata !== null ? ` · rata-rata ${angka(t.rataRata)}` : ''}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        {d.laju.map(t => (
          <span key={t.bulan} className="w-10 text-center first:text-left last:text-right">
            <span className="block">{t.label}</span>
            <span className="block font-semibold tabular-nums text-foreground">{t.nilai === null ? '—' : angka(t.nilai)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
