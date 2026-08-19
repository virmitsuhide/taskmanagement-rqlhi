import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, canViewGukarRecap } from '@/lib/auth/permissions'
import { UNIT_LABELS } from '@/lib/rq/programs'
import { getRqAnalytics, getUnitHafalanBoards } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UnitHafalanBoard } from '@/components/dashboard/UnitHafalanBoard'
import { Users, GraduationCap, BookMarked, Sparkles, ClipboardList } from 'lucide-react'

export default async function AnalitikPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/dashboard')

  const [a, boards] = await Promise.all([getRqAnalytics(), getUnitHafalanBoards()])
  const maxJenjang = Math.max(1, ...a.overview.studentsByJenjang.map(j => j.count))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik RQ" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Ringkasan Seluruh RQ</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik Rumah Qur&apos;an</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agregat lintas divisi &amp; halaqoh · {a.monthLabel}</p>
        </div>

        <Link
          href="/dashboard/analitik/unit"
          className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              <GraduationCap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Analitik per Unit &amp; Program →</p>
              <p className="text-xs text-muted-foreground">Capaian tahsin &amp; tahfidz, ujian juz&apos;iyah &amp; tasmi&apos; tiap unit/program</p>
            </div>
          </div>
        </Link>

        {/* Pembinaan gukar dipisah dari analitik santri: pesertanya pegawai,
            satuannya bulanan, dan pemiliknya SDM — bukan bagian dari capaian
            santri yang dirangkum di halaman ini. */}
        {canViewGukarRecap(session.role) && (
          <Link
            href="/dashboard/analitik/gukar"
            className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
                <BookMarked className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Analitik Halaqoh Qur&apos;an Guru &amp; Karyawan →</p>
                <p className="text-xs text-muted-foreground">Capaian tahsin &amp; tahfidz dan kehadiran pembinaan pegawai</p>
              </div>
            </div>
          </Link>
        )}

        <Link
          href="/dashboard/analitik/kelengkapan"
          className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Kelengkapan Pengisian Capaian →</p>
              <p className="text-xs text-muted-foreground">Halaqoh mana yang gurunya belum mengisi capaian bulan ini</p>
            </div>
          </div>
        </Link>

        {/* KPI utama */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={<Users className="h-4 w-4" />} label="Siswa Aktif" value={a.overview.activeStudents} />
          <Kpi icon={<GraduationCap className="h-4 w-4" />} label="Guru Aktif" value={a.overview.activeTeachers} />
          <Kpi icon={<BookMarked className="h-4 w-4" />} label="Halaqoh Aktif" value={a.overview.activeHalaqoh} />
        </div>

        {/* Capaian bulan ini */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Capaian Bulan Ini ({a.monthLabel})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Metric label="Setoran Tahsin" value={a.monthly.tahsinSetoran} />
            <Metric label="Setoran Tahfidz" value={a.monthly.tahfidzSetoran} />
            <Metric label="Kenaikan Jilid" value={a.monthly.jilidPromotions} accent />
            <Metric label="Kenaikan Juz" value={a.monthly.juzPromotions} accent />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            <Sparkles className="h-3 w-3 inline mr-1" />
            {a.juzMutqinTotal} juz sudah ditandai mutqin di seluruh RQ.
          </p>
        </section>

        {/* Distribusi jenjang */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <GraduationCap className="h-4 w-4" /> Distribusi Siswa per Jenjang
          </h2>
          {a.overview.activeStudents === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data siswa.</p>
          ) : (
            <div className="space-y-3">
              {a.overview.studentsByJenjang.map(j => (
                <div key={j.jenjang}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{UNIT_LABELS[j.jenjang]}</span>
                    <span className={j.count === 0 ? 'text-muted-foreground/60' : 'text-muted-foreground'}>
                      {j.count} siswa
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(j.count / maxJenjang) * 100}%`, background: 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 10 besar hafalan per unit + posisi vs target */}
        <UnitHafalanBoard boards={boards} />
      </div>
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-2xl font-bold mt-1.5 leading-none">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={accent && value > 0 ? { background: '#dcfce7' } : { background: 'var(--muted)' }}>
      <p className="text-2xl font-bold leading-none" style={{ color: accent && value > 0 ? '#15803d' : undefined }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
