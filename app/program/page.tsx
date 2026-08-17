import Link from 'next/link'
import { ArrowLeft, ArrowRight, Settings2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { getActivePrograms } from '@/lib/data/programs'
import { programAccent } from '@/lib/programs/theme'
import { ProgramIcon } from '@/components/programs/ProgramIcon'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/button'

export default async function ProgramPage() {
  const [programs, session] = await Promise.all([getActivePrograms(), getSession()])
  const canManage = session ? canEditProgram(session.role) : false

  return (
    <div>
      <PublicHeader />

      <div className="p-4 md:p-6 max-w-5xl mx-auto pb-16">
        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
            </Link>
            <h1 className="text-2xl font-bold leading-tight">Program RQ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {programs.length} program · Rumah Qur&apos;an LHI
            </p>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {programs.map(program => {
              const accent = programAccent(program.accent)
              return (
                <Link
                  key={program.slug}
                  href={`/program/${program.slug}`}
                  className="group flex flex-col rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md hover:border-foreground/20"
                >
                  {/* Gambar artikel; kalau kosong pakai gradasi aksen + ikon */}
                  <div className="relative w-full aspect-[16/10] overflow-hidden border-b">
                    {program.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={program.photo_url}
                        alt={program.title}
                        className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <span className={`flex h-full items-center justify-center bg-gradient-to-br ${accent.gradient}`}>
                        <ProgramIcon icon={program.icon} className={`h-9 w-9 ${accent.iconColor}`} />
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className={`h-1 w-10 rounded-full mb-3 ${accent.bar}`} />
                    <h2 className="font-semibold text-base leading-snug mb-1.5">{program.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                      {program.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      Selengkapnya
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
