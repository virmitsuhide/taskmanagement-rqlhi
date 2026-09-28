import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canKelolaPanduanGuru } from '@/lib/auth/permissions'
import { getPanduan, tautanPanduan } from '@/lib/data/panduan-guru'
import { LABEL_KATEGORI_PANDUAN, LABEL_SASARAN_PANDUAN } from '@/lib/rq/panduan-guru'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PembacaPdf } from '@/components/panduan/DaftarPanduan'

export default async function BacaPanduanPengurusPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canKelolaPanduanGuru(session.role)) redirect('/dashboard')

  const { id } = await params
  const p = await getPanduan(id)
  if (!p) notFound()
  const tautan = await tautanPanduan(p)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Panduan Guru" ownH1 />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
        <Link href="/panduan-guru" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Panduan Guru
        </Link>
        <div>
          <h1 className="text-2xl font-bold leading-tight">{p.judul}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[LABEL_KATEGORI_PANDUAN[p.kategori], LABEL_SASARAN_PANDUAN[p.sasaran], p.pengunggah?.display_name, p.keterangan].filter(Boolean).join(' · ')}
          </p>
        </div>
        {tautan
          ? <PembacaPdf judul={p.judul} lihat={tautan.lihat} unduh={tautan.unduh} />
          : <p className="text-sm text-destructive">Berkas tidak dapat dibuka.</p>}
      </div>
    </div>
  )
}
