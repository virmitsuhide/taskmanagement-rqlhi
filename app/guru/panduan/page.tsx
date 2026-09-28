import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getPanduanGuru } from '@/lib/data/panduan-guru'
import { URUTAN_KATEGORI_PANDUAN, type KategoriPanduan } from '@/lib/rq/panduan-guru'
import { HalamanGuru } from '@/components/guru/HalamanGuru'
import { DaftarPanduan } from '@/components/panduan/DaftarPanduan'

interface PageProps {
  searchParams: Promise<{ kategori?: string }>
}

/** Panduan Guru (0104): SOP & dokumen penting — dibaca di tempat, bisa diunduh. */
export default async function PanduanGuruPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const kategori = URUTAN_KATEGORI_PANDUAN.includes(sp.kategori as KategoriPanduan) ? (sp.kategori as KategoriPanduan) : null
  const daftar = await getPanduanGuru(session.teacherId)

  return (
    <HalamanGuru lebar="sedang" judul="Panduan Guru" keterangan="SOP kepegawaian, pembelajaran, keuangan, dan dokumen penting dari pengurus RQ.">
      {daftar === null ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Panduan belum tersedia.
        </div>
      ) : (
        <DaftarPanduan
          daftar={daftar}
          kategori={kategori}
          hrefKategori={k => (k ? `/guru/panduan?kategori=${k}` : '/guru/panduan')}
          hrefDokumen={id => `/guru/panduan/${id}`}
        />
      )}
    </HalamanGuru>
  )
}
