import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { PROGRAMS } from './_data'

export default async function ProgramPage() {
  const session = await getSession()
  const isLoggedIn = !!session?.isLoggedIn

  return (
    <div>
      {isLoggedIn && session ? (
        <DashboardHeader displayName={session.displayName} role={session.role} title="Program" />
      ) : (
        <PublicHeader />
      )}

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {!isLoggedIn && (
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
          </Link>
        )}

        <div className="mb-6">
          <p className="text-2xl font-bold leading-tight">Program RQ</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pilih program untuk melihat informasi lebih lengkap
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROGRAMS.map(program => {
            const Icon = program.icon
            return (
              <Link key={program.slug} href={`/program/${program.slug}`} className="group block h-full">
                <div className="h-full rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-foreground/20">
                  <div className={`h-1.5 w-full ${program.accent}`} />
                  <div className="p-5 flex flex-col h-[calc(100%-6px)]">
                    <div className={`inline-flex items-center justify-center rounded-xl p-3 mb-4 w-fit ${program.iconBg}`}>
                      <Icon className={`h-6 w-6 ${program.iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-base leading-snug mb-1.5">{program.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                      {program.description}
                    </p>
                    <div className="flex items-center gap-1 mt-4 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      <span>Lihat Detail</span>
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
