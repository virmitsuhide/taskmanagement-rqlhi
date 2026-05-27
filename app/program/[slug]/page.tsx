import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { canEditProgram } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, BookText, ListChecks, CalendarClock, Users2, Phone } from 'lucide-react'
import { findProgram } from '../_data'
import type { ProgramDetail } from '@/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getProgramDetail(slug: string): Promise<ProgramDetail | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('program_details')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    return (data as ProgramDetail | null) ?? null
  } catch {
    return null
  }
}

function Section({
  icon: Icon,
  title,
  content,
  iconColor,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: string
  iconColor: string
  iconBg: string
}) {
  if (!content) return null
  return (
    <div className="rounded-xl border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`inline-flex items-center justify-center rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <h2 className="font-semibold text-sm uppercase tracking-wide">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{content}</p>
    </div>
  )
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { slug } = await params
  const program = findProgram(slug)
  if (!program) notFound()

  const [session, detail] = await Promise.all([getSession(), getProgramDetail(slug)])
  const isLoggedIn = !!session?.isLoggedIn
  const canEdit = !!session && canEditProgram(session.role)

  const Icon = program.icon

  const hasContent =
    !!detail &&
    (detail.long_description ||
      detail.curriculum ||
      detail.schedule ||
      detail.target_audience ||
      detail.contact_info)

  return (
    <div>
      {isLoggedIn && session ? (
        <DashboardHeader
          displayName={session.displayName}
          role={session.role}
          breadcrumbs={[
            { label: 'Program', href: '/program' },
            { label: program.title },
          ]}
        />
      ) : (
        <PublicHeader />
      )}

      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/program"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Program
          </Link>

          {canEdit && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/program/${slug}/edit`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Detail
              </Link>
            </Button>
          )}
        </div>

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

        {hasContent ? (
          <div className="space-y-4">
            <Section
              icon={BookText}
              title="Deskripsi Program"
              content={detail!.long_description}
              iconColor={program.iconColor}
              iconBg={program.iconBg}
            />
            <Section
              icon={ListChecks}
              title="Kurikulum & Materi"
              content={detail!.curriculum}
              iconColor={program.iconColor}
              iconBg={program.iconBg}
            />
            <Section
              icon={CalendarClock}
              title="Jadwal & Durasi"
              content={detail!.schedule}
              iconColor={program.iconColor}
              iconBg={program.iconBg}
            />
            <Section
              icon={Users2}
              title="Target Peserta"
              content={detail!.target_audience}
              iconColor={program.iconColor}
              iconBg={program.iconBg}
            />
            <Section
              icon={Phone}
              title="Kontak & Pendaftaran"
              content={detail!.contact_info}
              iconColor={program.iconColor}
              iconBg={program.iconBg}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed py-14 text-center">
            <div className={`inline-flex items-center justify-center rounded-xl p-4 mb-4 ${program.iconBg}`}>
              <Icon className={`h-7 w-7 ${program.iconColor}`} />
            </div>
            <p className="font-medium text-sm">Konten sedang disiapkan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Informasi detail {program.title} akan segera tersedia
            </p>
            {canEdit && (
              <Button asChild size="sm" className="mt-5">
                <Link href={`/program/${slug}/edit`}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Isi Detail Program
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
