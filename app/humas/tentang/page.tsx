import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canEditAbout } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { AboutEditForm } from './AboutEditForm'
import type { AboutRq } from '@/types'

export default async function KelolaTentangPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditAbout(session.role)) redirect('/dashboard')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('about_rq')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const about = (data as AboutRq | null) ?? null

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelola Tentang RQ"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-2xl">
        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Kelola Tentang RQ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visi, misi, dan sejarah langsung terlihat di halaman publik. Bagan struktur
              organisasi mengikuti kode dan tidak diedit di sini.
            </p>
          </div>
          <Link
            href="/tentang"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline pt-1 shrink-0"
          >
            Lihat halaman publik <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <AboutEditForm defaultValues={about} />
      </div>
    </div>
  )
}
