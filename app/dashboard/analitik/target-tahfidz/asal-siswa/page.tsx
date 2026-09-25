import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageUjian, canTandaiAsalSdLhi } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { AsalSdLhiForm, type SiswaAsal } from '@/components/dashboard/target-tahfidz/AsalSdLhiForm'

/**
 * Penanda lulusan SD LHI untuk siswa SMP.
 *
 * Menentukan rencana target: internal (juz 30 dianggap sudah dibawa dari SD,
 * hafalan baru mulai juz 29) atau eksternal (mulai juz 30).
 */
export default async function AsalSiswaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canTandaiAsalSdLhi(session.role)) redirect('/dashboard/analitik/target-tahfidz')

  const { data, error } = await createServerClient()
    .from('students')
    .select('id, full_name, kelas, asal_sd_lhi, halaqoh:halaqoh!students_halaqoh_id_fkey(name)')
    .eq('is_active', true)
    .eq('jenjang', 'smp')
    .order('kelas')
    .order('full_name')

  const siswa: SiswaAsal[] = ((data ?? []) as unknown as {
    id: string; full_name: string; kelas: string | null; asal_sd_lhi: boolean; halaqoh: { name: string } | null
  }[]).map(s => ({ id: s.id, nama: s.full_name, kelas: s.kelas, halaqoh: s.halaqoh?.name ?? null, asalSdLhi: s.asal_sd_lhi }))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Asal Siswa SMP" showBack ownH1 />
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Target Tahfidz</p>
          <h1 className="text-3xl leading-tight">Siswa SMP Lulusan SD LHI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Yang dicentang memakai target <strong>internal</strong> (hafalan baru mulai juz 29). Selainnya memakai target eksternal (mulai juz 30).
          </p>
        </div>

        {error ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground bg-muted/30">
            {error.message.includes('asal_sd_lhi')
              ? 'Kolom asal siswa belum ada. Jalankan drizzle/0070_target_tahfidz_bulanan_PASTE_TO_SUPABASE.sql di Supabase SQL Editor, lalu muat ulang halaman ini.'
              : `Data siswa tidak terbaca: ${error.message}`}
          </p>
        ) : siswa.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground bg-muted/30">Belum ada siswa SMP aktif.</p>
        ) : (
          <>
            <AsalSdLhiForm siswa={siswa} />
            {canManageUjian(session.role, 'SMP') && (
              <p className="text-xs text-muted-foreground">
                Ujian tahfidz semasa SD belum tercatat?{' '}
                <Link href="/ujian/catat-riwayat/alumni-sd" className="text-primary hover:underline">Catat ujian alumni SD LHI →</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
