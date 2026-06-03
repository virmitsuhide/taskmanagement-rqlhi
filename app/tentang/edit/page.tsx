import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditAbout } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { AboutEditForm } from './AboutEditForm'
import type { AboutRq } from '@/types'

export default async function EditAboutPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canEditAbout(session.role)) redirect('/tentang')

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
        title="Edit Tentang RQ"
        breadcrumbs={[
          { label: 'Tentang RQ', href: '/tentang' },
          { label: 'Edit' },
        ]}
        ownH1
      />
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/tentang">
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Tentang RQ
          </Link>
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold mb-1.5 tracking-tight">
          Edit Konten Tentang RQ
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Visi, misi, dan sejarah akan langsung terlihat di halaman publik.
          Bagan struktur organisasi mengikuti kode dan tidak dapat diedit di sini.
        </p>

        <AboutEditForm defaultValues={about} />
      </div>
    </div>
  )
}
