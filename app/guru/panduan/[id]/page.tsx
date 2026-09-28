import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getPanduan, sasaranGuru, tautanPanduan } from '@/lib/data/panduan-guru'
import { LABEL_KATEGORI_PANDUAN } from '@/lib/rq/panduan-guru'
import { HalamanGuru } from '@/components/guru/HalamanGuru'
import { PembacaPdf } from '@/components/panduan/DaftarPanduan'

/** Membaca satu dokumen panduan — hanya bila sasarannya memang untuk guru ini. */
export default async function BacaPanduanGuruPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const [p, sasaran] = await Promise.all([getPanduan(id), sasaranGuru(session.teacherId)])
  if (!p || !sasaran.includes(p.sasaran)) notFound()
  const tautan = await tautanPanduan(p)

  return (
    <HalamanGuru
      lebar="lebar"
      judul={p.judul}
      keterangan={[LABEL_KATEGORI_PANDUAN[p.kategori], p.keterangan].filter(Boolean).join(' · ')}
      atas={
        <Link href="/guru/panduan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Panduan Guru
        </Link>
      }
    >
      {tautan
        ? <PembacaPdf judul={p.judul} lihat={tautan.lihat} unduh={tautan.unduh} />
        : <p className="text-sm text-destructive">Berkas tidak dapat dibuka. Hubungi pengunggahnya.</p>}
    </HalamanGuru>
  )
}
