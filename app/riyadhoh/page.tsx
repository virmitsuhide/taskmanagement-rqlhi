import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRiyadhoh } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { getJadwalRiyadhoh, getPengampuRiyadhoh, getSiswaRiyadhoh, jadwalSebelum } from '@/lib/data/riyadhoh'
import { sabtuDalamBulan } from '@/lib/rq/riyadhoh'
import { currentPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
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

  const sabtuAktif = jadwal ? sabtu.filter(t => jadwal[t]).length : 0
  const tanpaPengampu = siswa.filter(s => s.ikut && s.gender && !s.pengampu_id).length

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Riyadhoh Qur'an" showBack ownH1 />

      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Pembinaan Qur&apos;an · Kelola Riyadhoh Sabtu
            </p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">
              Riyadhoh {monthName(bulan)} —{' '}
              <em>
                {sabtuAktif} Sabtu aktif
                {tanpaPengampu > 0 ? `, ${tanpaPengampu} peserta belum punya pengampu.` : '.'}
              </em>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Halaqoh tambahan hari Sabtu untuk seluruh kelas 9 dan QuLS kelas 7–8. Putra dan putri masuk bergantian —
              tentukan tiap Sabtu milik siapa, pilih pengampunya, lalu pengampu mencatat kehadiran dan setoran di Portal Guru.
              Setoran Sabtu ikut menjadi capaian sekolah anak.
            </p>
          </div>
          <Link href="/riyadhoh/analitik" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-muted">
            <BarChart3 className="h-4 w-4" />Analitik
          </Link>
        </div>

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
