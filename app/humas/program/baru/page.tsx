import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { createProgramAction } from '@/app/actions/program'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ProgramForm } from '../ProgramForm'

export default async function TambahProgramPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditProgram(session.role)) redirect('/dashboard')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Tambah Program"
        breadcrumbs={[{ label: 'Program', href: '/humas/program' }, { label: 'Tambah' }]}
        ownH1
      />
      <div className="max-w-2xl px-4 md:px-6 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/humas/program">
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Kelola Program
          </Link>
        </Button>

        <h1 className="text-2xl font-bold mb-1.5 tracking-tight">Tambah Program</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Program baru ditaruh di urutan paling bawah. Urutannya bisa digeser dari daftar.
        </p>

        <ProgramForm action={createProgramAction} submitLabel="Simpan Program" />
      </div>
    </div>
  )
}
