import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { getProgramBySlug } from '@/lib/data/programs'
import { updateProgramAction } from '@/app/actions/program'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ProgramForm } from '../../ProgramForm'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function EditProgramPage({ params }: PageProps) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditProgram(session.role)) redirect('/dashboard')

  const program = await getProgramBySlug(slug)
  if (!program) notFound()

  const boundAction = updateProgramAction.bind(null, slug)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Edit Program"
        breadcrumbs={[
          { label: 'Program', href: '/humas/program' },
          { label: program.title, href: `/program/${slug}` },
          { label: 'Edit' },
        ]}
        ownH1
      />
      <div className="max-w-2xl px-4 md:px-6 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/humas/program">
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Kelola Program
          </Link>
        </Button>

        <h1 className="text-2xl font-bold mb-1.5 tracking-tight">Edit Program</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Perubahan langsung terlihat di beranda dan halaman publik program.
        </p>

        <ProgramForm
          action={boundAction}
          defaultValues={program}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </div>
  )
}
