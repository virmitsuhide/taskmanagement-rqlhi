import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ArrowLeft } from 'lucide-react'
import { findProgram } from '../_data'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { slug } = await params
  const program = findProgram(slug)
  if (!program) notFound()

  const Icon = program.icon

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[
          { label: 'Program', href: '/program' },
          { label: program.title },
        ]}
      />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Link
          href="/program"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Program
        </Link>

        {/* Hero */}
        <div className="rounded-xl border bg-card overflow-hidden mb-6">
          <div className={`h-2 w-full ${program.accent}`} />
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`shrink-0 inline-flex items-center justify-center rounded-xl p-4 ${program.iconBg}`}>
                <Icon className={`h-8 w-8 ${program.iconColor}`} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">{program.title}</h1>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{program.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder content */}
        <div className="rounded-xl border border-dashed py-14 text-center">
          <div className={`inline-flex items-center justify-center rounded-xl p-4 mb-4 ${program.iconBg}`}>
            <Icon className={`h-7 w-7 ${program.iconColor}`} />
          </div>
          <p className="font-medium text-sm">Konten sedang disiapkan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Informasi detail {program.title} akan segera tersedia
          </p>
        </div>
      </div>
    </div>
  )
}
