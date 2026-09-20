import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getRaporTemplate } from '@/lib/data/rapor-template'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PemetaanTemplate } from '@/components/rapor/PemetaanTemplate'
import { AturTemplate } from '@/components/rapor/AturTemplate'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PemetaanTemplatePage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const template = await getRaporTemplate(id)
  if (!template) notFound()
  if (!canManageRaporTemplate(session.role, template.jenjang)) redirect('/dashboard')

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title={template.nama} showBack ownH1 />

      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{template.nama}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {JENJANG_LABELS[template.jenjang]} · kelas {template.tingkat_min}
            {template.tingkat_max !== template.tingkat_min && `–${template.tingkat_max}`}
            {template.file_nama && ` · dari ${template.file_nama}`}
          </p>
        </div>

        <AturTemplate
          id={template.id}
          nama={template.nama}
          tingkatMin={template.tingkat_min}
          tingkatMax={template.tingkat_max}
          aktif={template.aktif}
        />

        <PemetaanTemplate
          id={template.id}
          blok={template.blok}
          pemetaan={template.pemetaan}
          pengesahan={{
            tempat_terbit: template.tempat_terbit,
            nama_koordinator: template.nama_koordinator,
            nip_koordinator: template.nip_koordinator,
          }}
        />
      </div>
    </div>
  )
}
