import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewRoutineBoard } from '@/lib/auth/permissions'
import { getRoutineBoard } from '@/lib/data/rutin'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { JumlahPengurus, PapanRutin } from '@/components/rutin/PapanRutin'
import { Button } from '@/components/ui/button'
import { labelPeriode } from '@/lib/rutin/periode'

/**
 * Papan tugas rutin seluruh pengurus — kepala RQ.
 *
 * Halaman baca saja. Kepala RQ melihat apa yang berjalan dan apa yang tidak,
 * tapi tidak melaporkan atas nama siapa pun: laporan tugas rutin adalah
 * pengakuan pemiliknya sendiri, dan laporan yang bisa diisikan orang lain
 * berhenti menjadi pengakuan.
 *
 * Penjaganya canViewRoutineBoard, bukan canViewTasks. Papan ini menampilkan
 * alasan pribadi tiap pengurus — satu-satunya tempat di aplikasi ini di mana
 * kalimat semacam itu terkumpul — jadi aksesnya sengaja lebih sempit
 * daripada modul tugas pada umumnya.
 */
export default async function PapanTugasRutinPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewRoutineBoard(session.role)) redirect('/tugas-rutin')

  const board = await getRoutineBoard()

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Papan Tugas Rutin"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Tugas Rutin', href: '/tugas-rutin' }, { label: 'Papan' }]}
      />

      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
            <Link href="/tugas-rutin">
              <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke tugas rutin saya
            </Link>
          </Button>

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">Papan Tugas Rutin</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Seluruh pekerjaan berulang pengurus pada periode yang sedang berjalan —
                pekanan ({labelPeriode('pekanan')}), bulanan ({labelPeriode('bulanan')}),
                semesteran, dan tahunan.
              </p>
            </div>
            <JumlahPengurus n={board.owners.length} />
          </div>

          <PapanRutin board={board} />

          <p className="mt-5 text-[11px] text-muted-foreground">
            💡 Papan ini hanya menampilkan periode yang sedang berjalan. Laporan periode
            sebelumnya tetap tersimpan, tapi tidak ikut ditampilkan di sini — yang perlu
            ditindaklanjuti adalah yang sedang terjadi.
          </p>
        </div>
      </div>
    </div>
  )
}
