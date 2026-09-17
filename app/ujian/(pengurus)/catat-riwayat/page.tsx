import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FormRiwayatTahfidz } from '@/components/ujian/FormRiwayatTahfidz'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'

export default async function CatatRiwayatUjianPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canSubmitUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Catat Riwayat Ujian"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Catat Riwayat' }]}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Catat Riwayat Tasmi&apos; Lama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Untuk tasmi&apos; 1, 3, dan 5 juz yang sudah terjadi sebelum sistem dipakai. Catatan langsung
            berstatus <em>Selesai</em> dan terhitung sebagai juz teruji — tanpa masuk antrian, tanpa
            notifikasi ke guru.
          </p>
        </div>

        <UjianSubNav />

        {units.includes('SMP') && (
          <Link
            href="/ujian/catat-riwayat/alumni-sd"
            className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              <GraduationCap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Ujian Alumni SD LHI →</p>
              <p className="text-xs text-muted-foreground">Siswa SMP lulusan SD LHI dengan ujian semasa SD yang belum tercatat</p>
            </div>
          </Link>
        )}

        <FormRiwayatTahfidz units={units} />
      </div>
    </div>
  )
}
