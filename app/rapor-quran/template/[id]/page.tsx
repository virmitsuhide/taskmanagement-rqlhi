import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getRaporTemplate } from '@/lib/data/rapor-template'
import { LABEL_JENIS_RAPOR } from '@/lib/rapor/jenis'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import { FileText } from 'lucide-react'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PageTitle } from '@/components/layout/PageTitle'
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

  const ttdKoordinator = await ttdSrc(template.ttd_koordinator_path)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        breadcrumbs={[{ label: 'Template Rapor', href: '/rapor-quran/template' }, { label: template.nama }]}
        showBack
        ownH1
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:p-6">
        <PageTitle icon={<FileText className="size-5" aria-hidden />} title={template.nama}>
          {LABEL_JENIS_RAPOR[template.jenis]} · {JENJANG_LABELS[template.jenjang]} · kelas {template.tingkat_min}
          {template.tingkat_max !== template.tingkat_min && `–${template.tingkat_max}`}
          {template.file_nama && <span className="break-all"> · dari {template.file_nama}</span>}
        </PageTitle>

        <AturTemplate
          id={template.id}
          nama={template.nama}
          tingkatMin={template.tingkat_min}
          tingkatMax={template.tingkat_max}
          aktif={template.aktif}
          jenis={template.jenis}
        />

        <PemetaanTemplate
          id={template.id}
          blok={template.blok}
          pemetaan={template.pemetaan}
          awalIsian={template.awal_isian}
          pengesahan={{
            tempat_terbit: template.tempat_terbit,
            nama_koordinator: template.nama_koordinator,
            nip_koordinator: template.nip_koordinator,
          }}
          ttdKoordinator={ttdKoordinator}
        />
      </div>
    </div>
  )
}
