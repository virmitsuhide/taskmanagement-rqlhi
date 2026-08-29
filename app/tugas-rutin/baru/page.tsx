import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { RoutineForm } from '@/components/rutin/RoutineForm'
import { Button } from '@/components/ui/button'
import { isCadence } from '@/lib/rutin/periode'

interface PageProps {
  searchParams: Promise<{ irama?: string }>
}

/**
 * Tambah tugas rutin.
 *
 * Tanpa penjaga peran: setiap pengurus yang bisa masuk berhak menyusun daftar
 * kerja rutinnya sendiri, dan server action-nya menautkan tugas baru ke
 * pemiliknya dari sesi — bukan dari isian form.
 */
export default async function TugasRutinBaruPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  // ?irama= dipakai kalau nanti ada pintasan "tambah tugas bulanan" langsung
  // dari kelompoknya; nilai asing diabaikan, bukan ditolak.
  const { irama } = await searchParams

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Tambah Tugas Rutin"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Tugas Rutin', href: '/tugas-rutin' }, { label: 'Tambah' }]}
      />

      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-2xl p-4 md:p-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
            <Link href="/tugas-rutin">
              <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke checklist
            </Link>
          </Button>

          <div className="mb-5">
            <h1 className="text-2xl font-bold leading-tight">Tambah Tugas Rutin</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Setelah disimpan, tugas ini muncul di checklist Anda dan bisa dicentang
              tiap periodenya.
            </p>
          </div>

          <RoutineForm defaultCadence={isCadence(irama) ? irama : undefined} />
        </div>
      </div>
    </div>
  )
}
