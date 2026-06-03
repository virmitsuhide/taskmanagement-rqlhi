import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { findProgram } from '../../_data'
import { ProgramEditForm } from './ProgramEditForm'
import type { ProgramDetail } from '@/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function EditProgramPage({ params }: PageProps) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditProgram(session.role)) redirect(`/program/${slug}`)

  const program = findProgram(slug)
  if (!program) notFound()

  const supabase = createServerClient()
  const { data } = await supabase
    .from('program_details')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  const detail = (data as ProgramDetail | null) ?? null

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Edit Program"
        breadcrumbs={[
          { label: 'Program', href: '/program' },
          { label: program.title, href: `/program/${slug}` },
          { label: 'Edit' },
        ]}
        ownH1
      />
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href={`/program/${slug}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke {program.title}
          </Link>
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold mb-1.5 tracking-tight">
          Edit Detail {program.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Perubahan akan langsung terlihat di halaman publik.
        </p>

        <ProgramEditForm slug={slug} defaultValues={detail} />
      </div>
    </div>
  )
}
