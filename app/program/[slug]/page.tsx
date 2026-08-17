import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { getProgramBySlug } from '@/lib/data/programs'
import { programAccent } from '@/lib/programs/theme'
import { ProgramIcon } from '@/components/programs/ProgramIcon'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, BookText, ListChecks, CalendarClock, Users2, Phone } from 'lucide-react'

interface PageProps {
  params: Promise<{ slug: string }>
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
  const [program, session] = await Promise.all([getProgramBySlug(slug), getSession()])
  if (!program) notFound()

  const isLoggedIn = !!session?.isLoggedIn
  const canEdit = !!session && canEditProgram(session.role)

  // Program yang disembunyikan hanya boleh dilihat pengelolanya.
  if (!program.is_active && !canEdit) notFound()

  const accent = programAccent(program.accent)

  const hasContent =
    program.long_description ||
    program.curriculum ||
    program.schedule ||
    program.target_audience ||
    program.contact_info

  return (
    <div>
      {isLoggedIn && session ? (
        <DashboardHeader
          displayName={session.displayName}
          role={session.role}
          breadcrumbs={[{ label: 'Program', href: '/program' }, { label: program.title }]}
        />
      ) : (
        <PublicHeader />
      )}

      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-16">
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
              <Link href={`/humas/program/${slug}/edit`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Program
              </Link>
            </Button>
          )}
        </div>

        {!program.is_active && canEdit && (
          <p className="mb-5 rounded-lg border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
            Program ini sedang <span className="font-medium text-foreground">disembunyikan</span> —
            pengunjung tidak bisa membukanya.
          </p>
        )}

        {/* Hero */}
        <div className="rounded-xl border bg-card overflow-hidden mb-6">
          {program.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={program.photo_url}
              alt={program.title}
              className="w-full aspect-[16/9] object-cover border-b"
            />
          ) : (
            <div className={`h-2 w-full ${accent.bar}`} />
          )}
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`shrink-0 inline-flex items-center justify-center rounded-xl p-4 ${accent.iconBg}`}>
                <ProgramIcon icon={program.icon} className={`h-8 w-8 ${accent.iconColor}`} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">{program.title}</h1>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {program.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {hasContent ? (
          <div className="space-y-4">
            <Section icon={BookText}     title="Deskripsi Program"     content={program.long_description} iconColor={accent.iconColor} iconBg={accent.iconBg} />
            <Section icon={ListChecks}   title="Kurikulum & Materi"    content={program.curriculum}       iconColor={accent.iconColor} iconBg={accent.iconBg} />
            <Section icon={CalendarClock} title="Jadwal & Durasi"      content={program.schedule}         iconColor={accent.iconColor} iconBg={accent.iconBg} />
            <Section icon={Users2}       title="Target Peserta"        content={program.target_audience}  iconColor={accent.iconColor} iconBg={accent.iconBg} />
            <Section icon={Phone}        title="Kontak & Pendaftaran"  content={program.contact_info}     iconColor={accent.iconColor} iconBg={accent.iconBg} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed py-14 text-center">
            <div className={`inline-flex items-center justify-center rounded-xl p-4 mb-4 ${accent.iconBg}`}>
              <ProgramIcon icon={program.icon} className={`h-7 w-7 ${accent.iconColor}`} />
            </div>
            <p className="font-medium text-sm">Konten sedang disiapkan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Informasi detail {program.title} akan segera tersedia
            </p>
            {canEdit && (
              <Button asChild size="sm" className="mt-5">
                <Link href={`/humas/program/${slug}/edit`}>
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
