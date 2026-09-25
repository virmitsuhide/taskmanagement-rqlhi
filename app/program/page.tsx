import Link from 'next/link'
import { ArrowLeft, ArrowRight, Settings2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { getActivePrograms } from '@/lib/data/programs'
import { programAccent } from '@/lib/programs/theme'
import { ProgramIcon } from '@/components/programs/ProgramIcon'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Button } from '@/components/ui/button'

export default async function ProgramPage() {
  const [programs, session] = await Promise.all([getActivePrograms(), getSession()])
  const canManage = session ? canEditProgram(session.role) : false

  return (
    <div>
      <PublicHeader />

      <div className="p-4 md:p-8 max-w-6xl mx-auto pb-16">
        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Program Rumah Qur&apos;an</p>
            <h1 className="mt-2 font-heading text-4xl font-normal leading-[1.02] tracking-[-0.02em] md:text-[64px]">
              Dari jilid pertama<br />
              <span className="italic text-primary">hingga sanad.</span>
            </h1>
          </div>
          <p className="max-w-md self-end text-[15px] leading-relaxed text-muted-foreground">
            {programs.length} program pembinaan Al-Qur&apos;an — dari tahsin jilid, tahfidz, sampai kelas takhassus — sesuai jenjang anak.
          </p>
          {canManage && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/humas/program">
                <Settings2 className="h-4 w-4 mr-1" />Kelola Program
              </Link>
            </Button>
          )}
        </div>

        {programs.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">Belum ada program yang ditampilkan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {programs.map(program => {
              const accent = programAccent(program.accent)
              return (
                <Link
                  key={program.slug}
                  href={`/program/${program.slug}`}
                  className="group grid gap-5 rounded-[22px] border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl sm:aspect-auto sm:h-full sm:min-h-[180px]">
                    {program.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={program.photo_url}
                        alt={program.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className={`flex h-full items-center justify-center bg-gradient-to-br ${accent.gradient}`}>
                        <ProgramIcon icon={program.icon} className={`h-9 w-9 ${accent.iconColor}`} />
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2.5 py-1">
                    {program.target_audience && (
                      <span className="w-fit rounded-full bg-primary-wash px-2.5 py-0.5 text-[11px] font-semibold text-primary line-clamp-1">
                        {program.target_audience}
                      </span>
                    )}
                    <h2 className="font-heading text-3xl font-normal leading-[1.05]">{program.title}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {program.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">
                      Pelajari program
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  )
}
