import { redirect } from 'next/navigation'
import { CalendarHeart } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRiyadhoh } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { getJadwalRiyadhoh, getPengampuRiyadhoh, getSiswaRiyadhoh, jadwalSebelum } from '@/lib/data/riyadhoh'
import { sabtuDalamBulan } from '@/lib/rq/riyadhoh'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PageTitle } from '@/components/layout/PageTitle'
import { KelolaRiyadhoh } from '@/components/riyadhoh/KelolaRiyadhoh'

/**
 * Riyadhoh Qur'an SMP — halaqoh tambahan hari Sabtu, milik koordinator SMP.
 *
 * Tiga hal diatur di sini: Sabtu mana milik putra dan mana milik putri,
 * guru siapa yang mengampu, dan siapa pesertanya. Pencatatan kehadiran dan
 * setorannya dilakukan pengampu di Portal Guru → Riyadhoh.
 */
export default async function RiyadhohPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageRiyadhoh(session.role)) redirect('/dashboard')

  const { bulan: diminta } = await searchParams
  const bulan = isValidPeriod(diminta ?? '') ? diminta! : currentPeriod()
  const sabtu = sabtuDalamBulan(bulan)

  const [jadwal, sebelum, pengampu, siswa, guruRes] = await Promise.all([
    getJadwalRiyadhoh(sabtu[0], sabtu[sabtu.length - 1]),
    jadwalSebelum(sabtu[0]),
    getPengampuRiyadhoh(),
    getSiswaRiyadhoh(),
    createServerClient().from('teachers').select('id, full_name, unit').eq('is_active', true).order('full_name'),
  ])

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Riyadhoh Qur'an" showBack ownH1 />

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 md:p-6">
        <PageTitle icon={<CalendarHeart className="size-5" aria-hidden />} title="Riyadhoh Qur'an">
          Halaqoh tambahan hari Sabtu untuk seluruh kelas 9 dan QuLS kelas 7–8. Putra dan putri masuk bergantian —
          tentukan tiap Sabtu milik siapa, pilih pengampunya, lalu pengampu mencatat kehadiran dan setoran di Portal Guru.
          Setoran Sabtu ikut menjadi capaian sekolah anak.
        </PageTitle>

        {jadwal === null ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Tabel Riyadhoh belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0087_riyadhoh_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu.
          </div>
        ) : (
          <KelolaRiyadhoh
            bulan={bulan}
            sabtu={sabtu}
            jadwal={jadwal}
            giliranSebelum={sebelum}
            pengampu={pengampu}
            siswa={siswa}
            guru={(guruRes.data ?? []) as { id: string; full_name: string; unit: string | null }[]}
          />
        )}
      </div>
    </div>
  )
}
