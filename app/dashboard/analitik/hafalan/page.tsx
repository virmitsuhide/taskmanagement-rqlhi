import { redirect } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, getAnalyticsProgramScope,
} from '@/lib/auth/permissions'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import { getUnitHafalanBoards } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, Panel, Slicer, hrefDengan } from '@/components/dashboard/kit'
import { DaftarPeringkat, nilaiTeratas, susunPeringkat } from '@/components/analitik/PeringkatHafalan'
import { Pagination } from '@/components/ui/pagination'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; page?: string }>
}

const PATH = '/dashboard/analitik/hafalan'
const PER_HALAMAN = 30

/**
 * Peringkat hafalan lengkap — lanjutan panel "10 Besar Hafalan" di
 * /dashboard/analitik. Urutan dan angkanya sama persis (susunPeringkat),
 * hanya tidak dipotong di sepuluh, dan dibagi per 30 nama.
 *
 * Lingkup akses sama dengan halaman analitik: manajemen semua unit,
 * koordinator dikunci ke unitnya (dan koor QULS SD ke anak QULS).
 */
export default async function PeringkatHafalanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const penuh = canViewAnalytics(session.role)
  const program = getAnalyticsProgramScope(session.role)
  const unitBoleh = penuh ? UNIT_ORDER : UNIT_ORDER.filter(j => getAnalyticsJenjang(session.role).includes(j))
  const unitDiminta = unitBoleh.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : null
  const jenjang: Jenjang | null = penuh ? unitDiminta : (unitDiminta ?? unitBoleh[0] ?? null)
  if (!penuh && !jenjang) redirect('/dashboard')

  const semua = (await getUnitHafalanBoards(program)).filter(b => unitBoleh.includes(b.jenjang))
  const boards = jenjang ? semua.filter(b => b.jenjang === jenjang) : semua
  const { perHalaman, siswa } = susunPeringkat(boards)

  const totalHalaman = Math.max(1, Math.ceil(siswa.length / PER_HALAMAN))
  const diminta = Number.parseInt(sp.page ?? '1', 10)
  const halaman = Number.isFinite(diminta) ? Math.min(Math.max(1, diminta), totalHalaman) : 1
  const awal = (halaman - 1) * PER_HALAMAN
  const potong = siswa.slice(awal, awal + PER_HALAMAN)

  const cakupan = program && jenjang === 'sd' ? 'QULS SD' : jenjang ? UNIT_LABELS[jenjang] : 'Seluruh RQ'
  const opsiUnit = [
    ...(penuh ? [{ label: 'Semua', href: PATH, active: !jenjang }] : []),
    ...semua.filter(b => b.studentCount > 0 || b.jenjang === jenjang).map(b => ({
      label: b.label, href: hrefDengan(PATH, {}, { unit: b.jenjang }), active: jenjang === b.jenjang,
    })),
  ]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Peringkat Hafalan" showBack ownH1 />
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <DashTop
          eyebrow={`Analitik Rumah Qur'an · ${penuh ? 'Manajemen' : 'Koordinator'}`}
          title="Peringkat hafalan siswa"
          context={<>{cakupan} · {siswa.length.toLocaleString('id-ID')} siswa dengan hafalan tercatat</>}
          filters={opsiUnit.length > 1 ? <Slicer label="Unit" options={opsiUnit} /> : null}
        />

        <Panel
          title={siswa.length > 0 ? `Peringkat ${awal + 1}–${awal + potong.length}` : 'Peringkat'}
          icon={<Trophy className="h-4 w-4" />}
          sub={perHalaman
            ? `${cakupan} · halaman Juz 30 utuh, urut An-Nas → An-Naba'`
            : `${cakupan} · total hafalan (juz utuh + halaman), dari setoran & ujian`}
        >
          {siswa.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data hafalan di {cakupan}.</p>
          ) : (
            <>
              <DaftarPeringkat
                siswa={potong}
                perHalaman={perHalaman}
                mulai={awal + 1}
                maks={nilaiTeratas(siswa, perHalaman)}
                tampilUnit={!jenjang}
                kolom={false}
              />
              <Pagination
                page={halaman}
                pageSize={PER_HALAMAN}
                total={siswa.length}
                basePath={PATH}
                searchParams={{ unit: jenjang ?? undefined }}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
