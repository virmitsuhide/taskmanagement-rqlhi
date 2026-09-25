import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageUjian, canTandaiAsalSdLhi } from '@/lib/auth/permissions'
import { getUjianAlumniSd } from '@/lib/data/ujian'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { UjianAlumniSd } from '@/components/ujian/UjianAlumniSd'

export default async function UjianAlumniSdPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageUjian(session.role, 'SMP')) redirect('/ujian/catat-riwayat')

  const { siswa, kolomAda } = await getUjianAlumniSd()
  const tautanTandai = canTandaiAsalSdLhi(session.role)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Ujian Alumni SD LHI"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Catat Riwayat', href: '/ujian/catat-riwayat' }, { label: 'Alumni SD LHI' }]}
      />

      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-3xl leading-tight">Ujian Tahfidz Alumni SD LHI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat ujian yang ditempuh siswa SMP semasa di SDIT LHI. Tercatat sebagai ujian unit SD berstatus
            <em> Selesai</em>, langsung terhitung juz teruji dan posisi terhadap target SMPIT internal — tanpa
            antrian dan tanpa notifikasi ke guru.
          </p>
        </div>

        <UjianSubNav />

        {!kolomAda ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground bg-muted/30">
            Penanda lulusan SD LHI belum ada — jalankan migrasi 0070 di Supabase lebih dulu.
          </p>
        ) : siswa.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground bg-muted/30">
            Belum ada siswa SMP yang ditandai lulusan SD LHI.
            {tautanTandai && (
              <> <Link href="/dashboard/analitik/target-tahfidz/asal-siswa" className="text-primary hover:underline">Tandai sekarang →</Link></>
            )}
          </p>
        ) : (
          <UjianAlumniSd siswa={siswa} />
        )}
      </div>
    </div>
  )
}
