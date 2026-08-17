import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ExternalLink, ImageOff, LayoutGrid, Eye, EyeOff } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { getAllPrograms } from '@/lib/data/programs'
import { programAccent } from '@/lib/programs/theme'
import { ProgramIcon } from '@/components/programs/ProgramIcon'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ProgramRowActions } from './ProgramRowActions'

export default async function KelolaProgramPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditProgram(session.role)) redirect('/dashboard')

  const programs = await getAllPrograms()
  const aktif = programs.filter(p => p.is_active).length

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelola Program"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Kelola Program RQ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tambah, ubah, dan atur urutan program. Urutan di sini menentukan urutan di beranda.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href="/program"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-1"
            >
              Lihat halaman publik <ExternalLink className="h-3 w-3" />
            </Link>
            <Button asChild size="sm">
              <Link href="/humas/program/baru">
                <Plus className="h-4 w-4 mr-1" />Tambah Program
              </Link>
            </Button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-md">
          <StatTile icon={<LayoutGrid className="h-4 w-4" />} label="Total" value={programs.length} />
          <StatTile icon={<Eye className="h-4 w-4" />} label="Tampil" value={aktif} tone="success" />
          <StatTile icon={<EyeOff className="h-4 w-4" />} label="Disembunyikan" value={programs.length - aktif} tone="muted" />
        </div>

        {programs.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada program. Tambahkan program pertama untuk menampilkannya di beranda.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/humas/program/baru">
                <Plus className="h-4 w-4 mr-1" />Tambah Program
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_110px_190px] gap-3 px-4 py-2.5 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Program</span>
              <span>Status</span>
              <span className="text-right">Urutan &amp; Aksi</span>
            </div>

            <ul className="divide-y">
              {programs.map((p, i) => {
                const accent = programAccent(p.accent)
                return (
                  <li
                    key={p.slug}
                    className="grid md:grid-cols-[1fr_110px_190px] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0 w-16 h-12 rounded-md overflow-hidden border bg-muted">
                        {p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className={`flex h-full items-center justify-center bg-gradient-to-br ${accent.gradient}`}>
                            <ProgramIcon icon={p.icon} className={`h-4 w-4 ${accent.iconColor}`} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/humas/program/${p.slug}/edit`}
                          className="block font-medium text-sm leading-snug hover:underline truncate"
                        >
                          {p.title}
                        </Link>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {p.description || 'Belum ada ringkasan'}
                        </p>
                        {!p.photo_url && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 inline-flex items-center gap-1">
                            <ImageOff className="h-3 w-3" /> belum ada foto
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success-wash px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />Tampil
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />Disembunyikan
                        </span>
                      )}
                    </div>

                    <div className="md:justify-self-end">
                      <ProgramRowActions
                        slug={p.slug}
                        title={p.title}
                        isActive={p.is_active}
                        isFirst={i === 0}
                        isLast={i === programs.length - 1}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'success' | 'muted'
}) {
  const valueColor =
    tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground'
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </span>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}
