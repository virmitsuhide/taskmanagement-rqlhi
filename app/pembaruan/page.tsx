import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canKelolaChangelog, canViewChangelog } from '@/lib/auth/permissions'
import { getChangelog } from '@/lib/data/changelog'
import { LABEL_PEMBACA, URUTAN_PEMBACA, type PembacaChangelog } from '@/lib/rq/changelog'
import { tanggalWIB } from '@/lib/rq/ujian'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, Slicer } from '@/components/dashboard/kit'
import { DaftarChangelog } from '@/components/changelog/DaftarChangelog'
import { KelolaChangelog } from '@/components/changelog/KelolaChangelog'
import { TandaiPembaruanDibaca } from '@/components/changelog/PembaruanBaru'

interface PageProps {
  searchParams: Promise<{ untuk?: string }>
}

/**
 * Pembaruan Sistem (0121). Kepala RQ menulis kabar perubahan fitur untuk
 * pengurus, guru, dan karyawan — terpisah per pembaca. Pengurus lain hanya
 * membaca yang ditujukan kepada pengurus.
 */
export default async function PembaruanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewChangelog(session.role)) redirect('/dashboard')
  const kelola = canKelolaChangelog(session.role)

  if (!kelola) {
    const daftar = await getChangelog('pengurus')
    return (
      <div>
        <DashboardHeader displayName={session.displayName} role={session.role} title="Pembaruan Sistem" ownH1 />
        <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
          <DashTop eyebrow="Sistem · Pembaruan" title="Pembaruan Sistem"
            context="Kabar fitur baru, perubahan, dan perbaikan dari Kepala RQ." filters={null} />
          <DaftarChangelog daftar={daftar} />
          <TandaiPembaruanDibaca pembaca="pengurus" terbaru={daftar?.[0]?.terbit_at ?? null} />
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const untuk = URUTAN_PEMBACA.includes(sp.untuk as PembacaChangelog) ? (sp.untuk as PembacaChangelog) : null
  const semua = await getChangelog(null)
  const daftar = (semua ?? []).filter(e => !untuk || e.untuk.includes(untuk))
  const sekarang = new Date().toISOString()
  // Kepala RQ juga pembaca pengurus: kabar pengurus yang sudah terbit dianggap terbaca di sini.
  const terbaruPengurus = (semua ?? []).find(e => e.untuk.includes('pengurus') && e.terbit_at <= sekarang)?.terbit_at ?? null

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Pembaruan Sistem" ownH1 />
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <DashTop eyebrow="Sistem · Pembaruan" title="Pembaruan Sistem"
          context="Beritahukan perubahan fitur kepada pengguna — pengurus di dashboard, guru di portal guru, karyawan di portal karyawan."
          filters={
            <Slicer label="Pembaca" options={[
              { label: 'Semua', href: '/pembaruan', active: !untuk },
              ...URUTAN_PEMBACA.map(p => ({ label: LABEL_PEMBACA[p], href: `/pembaruan?untuk=${p}`, active: untuk === p })),
            ]} />
          } />
        {semua === null ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel pembaruan belum ada. Jalankan <code className="text-xs">drizzle/0121_changelog_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </p>
        ) : (
          <KelolaChangelog daftar={daftar} hariIni={tanggalWIB(new Date())} sekarang={sekarang}
            pembacaAwal={untuk ? [untuk] : ['pengurus', 'guru']} />
        )}
        <TandaiPembaruanDibaca pembaca="pengurus" terbaru={terbaruPengurus} />
      </div>
    </div>
  )
}
