'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown, GraduationCap, BookOpen, Sparkles, Award, Users, UserCog, BookMarked, BarChart3,
} from 'lucide-react'
import { StarValue } from '@/components/StarValue'
import { cn } from '@/lib/utils'
import type { UnitLearning, ProgramAnalytics } from '@/lib/data/analytics'

interface Props {
  units: UnitLearning[]
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function avgOf(vals: (number | null)[]): number | null {
  const n = vals.filter((v): v is number => v !== null)
  if (n.length === 0) return null
  return Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 2) / 2
}

export function UnitProgramAnalytics({ units }: Props) {
  const [activeUnit, setActiveUnit] = useState(() => {
    const withStudents = units.find(u => u.studentCount > 0)
    return (withStudents ?? units[0])?.jenjang
  })
  const unit = units.find(u => u.jenjang === activeUnit) ?? units[0]

  return (
    <div>
      {/* Tab unit */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {units.map(u => {
          const active = u.jenjang === activeUnit
          return (
            <button
              key={u.jenjang}
              type="button"
              onClick={() => setActiveUnit(u.jenjang)}
              aria-pressed={active}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border',
              )}
            >
              {u.label} <span className="opacity-70">· {u.studentCount}</span>
            </button>
          )
        })}
      </div>

      {unit && <UnitPanel unit={unit} />}
    </div>
  )
}

function UnitPanel({ unit }: { unit: UnitLearning }) {
  const [showTT, setShowTT] = useState(false)

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">{unit.label}</h2>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />{unit.studentCount} siswa
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {unit.hasPrograms ? `${unit.programs.length} program` : 'Tanpa program (hanya tahsin & tahfidz)'}
        </p>

        {unit.studentCount === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Belum ada siswa aktif di unit ini.</p>
        ) : (
          <div className="space-y-2">
            {unit.programs.map(p => (
              <ProgramPanel
                key={`${unit.jenjang}::${p.code ?? 'untagged'}`}
                program={p}
                showExams={unit.jenjang !== 'paud'}
                singleProgram={!unit.hasPrograms}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tombol reveal analitik tahsin & tahfidz */}
      <button
        type="button"
        onClick={() => setShowTT(v => !v)}
        aria-expanded={showTT}
        className="w-full flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-primary" />
        {showTT ? 'Sembunyikan' : 'Lihat'} Analitik Tahsin &amp; Tahfidz — {unit.label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', showTT && 'rotate-180')} />
      </button>

      {showTT && <TahsinTahfidzView unit={unit} />}
    </div>
  )
}

function TahsinTahfidzView({ unit }: { unit: UnitLearning }) {
  const [nowMonth] = useState(() => new Date().getMonth() + 1) // 1-12
  const [nowYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(nowMonth)
  const [year, setYear] = useState(nowYear)

  // Tahun yang tersedia dari data + tahun berjalan.
  const years = useMemo(() => {
    const set = new Set<number>([nowYear])
    for (const l of [...unit.logs.tahsin, ...unit.logs.tahfidz, ...unit.logs.tasmi]) {
      set.add(Number(l.date.slice(0, 4)))
    }
    return [...set].sort((a, b) => b - a)
  }, [unit, nowYear])

  const inPeriod = (date: string) => Number(date.slice(0, 4)) === year && Number(date.slice(5, 7)) === month

  const tahsin = unit.logs.tahsin.filter(l => inPeriod(l.date))
  const tahfidz = unit.logs.tahfidz.filter(l => inPeriod(l.date))
  const tasmi = unit.logs.tasmi.filter(l => inPeriod(l.date))

  const normKind = (k: string) => (k === 'hafalan_baru' ? 'ziyadah' : k === 'murojaah' ? 'murojaah_baru' : k)
  const tahsinAvg = { f: avgOf(tahsin.map(l => l.f)), t: avgOf(tahsin.map(l => l.t)), k: avgOf(tahsin.map(l => l.k)) }
  const tahfidzAll = [...tahfidz, ...tasmi]
  const tahfidzAvg = { f: avgOf(tahfidzAll.map(l => l.f)), t: avgOf(tahfidzAll.map(l => l.t)), k: avgOf(tahfidzAll.map(l => l.k)) }

  const maxMethod = Math.max(1, ...unit.byMethod.map(m => m.count))
  const maxJuz = Math.max(1, ...unit.juzHistogram.map(j => j.students))

  return (
    <div className="space-y-6 rounded-xl border bg-muted/20 p-4 md:p-5">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Siswa Aktif" value={unit.kpi.activeStudents} />
        <Kpi icon={<UserCog className="h-4 w-4" />} label="Pengampu" value={unit.kpi.teachers} />
        <Kpi icon={<BookMarked className="h-4 w-4" />} label="Halaqoh" value={unit.kpi.halaqoh} />
      </div>

      {/* Tahsin & Tahfidz bulan terpilih */}
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="text-sm font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Tahsin</h3>
            <div className="flex items-center gap-1.5">
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="text-xs border rounded-md px-2 py-1 bg-background">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="text-xs border rounded-md px-2 py-1 bg-background">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Metric label="Setoran" value={tahsin.length} />
            <Metric label="Lulus" value={tahsin.filter(l => l.status === 'lulus').length} accent />
            <Metric label="Ulang" value={tahsin.filter(l => l.status === 'ulang').length} />
          </div>
          <ScoreRows avg={tahsinAvg} />
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4" /> Tahfidz <span className="text-xs font-normal text-muted-foreground">({MONTHS[month - 1]} {year})</span></h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Metric label="Ziyadah" value={tahfidz.filter(l => normKind(l.kind) === 'ziyadah').length} accent />
            <Metric label="Muroj. Baru" value={tahfidz.filter(l => normKind(l.kind) === 'murojaah_baru').length} />
            <Metric label="Muroj. Lama" value={tahfidz.filter(l => normKind(l.kind) === 'murojaah_lama').length} />
            <Metric label="Tasmi'" value={tasmi.length} />
          </div>
          <ScoreRows avg={tahfidzAvg} />
        </section>
      </div>

      {/* Siswa per metode */}
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Siswa per Metode</h3>
        {unit.byMethod.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {unit.byMethod.map(m => <Bar key={m.method} label={m.method} value={m.count} max={maxMethod} suffix="siswa" />)}
          </div>
        )}
      </section>

      {/* Sebaran siswa per tahap */}
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Sebaran Siswa per Tahap</h3>
        <p className="text-xs text-muted-foreground mb-3">Jumlah siswa aktif di tiap jilid/tahap.</p>
        {unit.levelDistribution.length === 0 ? <Empty /> : (
          <div className="grid md:grid-cols-3 gap-5">
            {unit.levelDistribution.map(m => {
              const maxLvl = Math.max(1, ...m.levels.map(l => l.count))
              return (
                <div key={m.method}>
                  <p className="text-xs font-semibold mb-2">{m.method}</p>
                  <div className="space-y-1.5">
                    {m.levels.map(l => (
                      <div key={l.order_num} className="flex items-center gap-2">
                        <span className="text-[11px] w-24 shrink-0 truncate" title={l.label}>{l.isTerminal ? '🎓 ' : ''}{l.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(l.count / maxLvl) * 100}%`, background: l.isTerminal ? '#16a34a' : l.isQuran ? '#0ea5e9' : 'var(--primary)' }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground w-5 text-right tabular-nums">{l.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sebaran tahapan jilid per kelas */}
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Sebaran Tahapan Jilid per Kelas</h3>
        {unit.jilidByKelas.length === 0 ? <Empty /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {unit.jilidByKelas.map(k => (
              <div key={k.kelas} className="rounded-lg border p-3">
                <p className="text-xs font-semibold mb-2">Kelas {k.kelas} <span className="font-normal text-muted-foreground">· {k.total} siswa</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {k.levels.map(l => (
                    <span key={l.label} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">
                      {l.label}: <span className="font-medium">{l.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sebaran hafalan per juz */}
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Sebaran Hafalan per Juz</h3>
        <p className="text-xs text-muted-foreground mb-3">Berapa siswa yang sedang di tiap juz (urutan 30→26 lalu 1→25).</p>
        {unit.juzHistogram.length === 0 ? <Empty /> : (
          <div className="flex items-end gap-1 h-28">
            {Array.from({ length: 30 }, (_, i) => 30 - i).map(juz => {
              const count = unit.juzHistogram.find(j => j.juz === juz)?.students ?? 0
              return (
                <div key={juz} className="flex-1 flex flex-col items-center justify-end h-full" title={`Juz ${juz}: ${count} siswa`}>
                  <div className="w-full rounded-t" style={{ height: `${(count / maxJuz) * 100}%`, minHeight: count > 0 ? 4 : 0, background: 'var(--primary)' }} />
                  {juz % 5 === 0 && <span className="text-[8px] text-muted-foreground mt-0.5">{juz}</span>}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sebaran jumlah juz dihafal per kelas */}
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Award className="h-4 w-4" /> Sebaran Jumlah Juz Dihafal per Kelas</h3>
        <p className="text-xs text-muted-foreground mb-3">Jumlah juz tuntas tiap anak (juz yang sedang dihafal belum dihitung).</p>
        {unit.juzByKelas.length === 0 ? <Empty /> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {unit.juzByKelas.map(k => (
              <div key={k.kelas} className="rounded-lg border p-3">
                <p className="text-xs font-semibold mb-2">
                  Kelas {k.kelas} <span className="font-normal text-muted-foreground">· {k.total} anak · rata-rata {k.avgJuz} juz</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {k.distribution.map(d => (
                    <span key={d.juzCount} className="text-[11px] px-2 py-0.5 rounded-full bg-muted" title={`${d.students} anak hafal ${d.juzCount} juz`}>
                      <span className="font-medium">{d.students}</span> anak: {d.juzCount} juz
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Program panel (kartu program yang bisa di-expand) ──
function ProgramPanel({ program, showExams, singleProgram }: {
  program: ProgramAnalytics
  showExams: boolean
  singleProgram: boolean
}) {
  const [open, setOpen] = useState(singleProgram)

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium">{program.label}</span>
        <span className="text-[11px] text-muted-foreground">· {program.studentCount} siswa</span>
        <div className="ml-auto flex items-center gap-2">
          {program.tahsin.lulus > 0 && <Badge tone="green">{program.tahsin.lulus} lulus tahsin</Badge>}
          {program.tahfidz.juzMutqin > 0 && <Badge tone="blue">{program.tahfidz.juzMutqin} juz mutqin</Badge>}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-4 border-t pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat icon={<BookOpen className="h-3.5 w-3.5" />} label="Lulus Tahsin" value={program.tahsin.lulus} accent />
            <Stat icon={<BookOpen className="h-3.5 w-3.5" />} label="Masih Tahsin" value={program.tahsin.belumLulus} />
            <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Total Ayat Hafal" value={program.tahfidz.totalAyatHafal} />
            <Stat icon={<Award className="h-3.5 w-3.5" />} label="Juz Mutqin" value={program.tahfidz.juzMutqin} />
          </div>

          {showExams && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Ujian Juz&apos;iyah ({program.juziyah.length})</h4>
                {program.juziyah.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada ujian juz&apos;iyah.</p> : (
                  <ul className="space-y-1.5">
                    {program.juziyah.map((e, i) => (
                      <li key={i} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate"><span className="font-medium">{e.studentName}</span> · Juz {e.juz}</span>
                        <span className="text-muted-foreground shrink-0">{e.score !== null && <span className="font-medium text-foreground">{e.score}</span>} · {formatDate(e.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Tasmi&apos; ({program.tasmi.length})</h4>
                {program.tasmi.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada tasmi&apos;.</p> : (
                  <ul className="space-y-1.5">
                    {program.tasmi.map((e, i) => (
                      <li key={i} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate"><span className="font-medium">{e.studentName}</span> · {e.scopeJuz} juz (Juz {e.juzFrom}–{e.juzTo})</span>
                        <span className="shrink-0 flex items-center gap-1">
                          <Badge tone={e.status === 'lulus' ? 'green' : 'amber'}>{e.status}</Badge>
                          <span className="text-muted-foreground">{formatDate(e.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-komponen kecil ──
function ScoreRows({ avg }: { avg: { f: number | null; t: number | null; k: number | null } }) {
  const rows: [string, number | null][] = [['Fashohah', avg.f], ['Tajwid', avg.t], ['Kelancaran', avg.k]]
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Rata-rata nilai</p>
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-xs">{label}</span>
          <StarValue value={val} size={15} />
        </div>
      ))}
    </div>
  )
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} {suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: 'var(--primary)' }} />
      </div>
    </div>
  )
}

function Empty() { return <p className="text-sm text-muted-foreground">Belum ada data.</p> }

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-2xl font-bold mt-1 leading-none">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg p-2.5" style={accent && value > 0 ? { background: '#dcfce7' } : { background: 'var(--muted)' }}>
      <p className="text-xl font-bold leading-none" style={{ color: accent && value > 0 ? '#15803d' : undefined }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
      <p className="text-lg font-bold mt-0.5 leading-none" style={accent && value > 0 ? { color: '#15803d' } : undefined}>{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

const BADGE_TONE: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
}
function Badge({ tone, children }: { tone: keyof typeof BADGE_TONE; children: React.ReactNode }) {
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', BADGE_TONE[tone])}>{children}</span>
}
