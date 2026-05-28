import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { getStudentRaporData } from '@/lib/data/rapor'
import { createRaporToken } from '@/lib/rapor-token'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { RaporDocument } from '@/components/rapor/RaporDocument'
import { RaporShareButton } from './RaporShareButton'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; month?: string }>
}

function buildSummary(data: NonNullable<Awaited<ReturnType<typeof getStudentRaporData>>>): string {
  const lines: string[] = []
  if (data.tahsin.currentMethod && data.tahsin.currentJilid) {
    lines.push(`📖 Tahsin: ${data.tahsin.currentMethod} ${data.tahsin.currentJilid} (hal. ${data.tahsin.currentPage ?? '—'})`)
  }
  if (data.tahsin.promotions.length > 0) {
    lines.push(`✅ Naik jilid: ${data.tahsin.promotions.map(p => p.to).join(', ')}`)
  }
  if (data.tahfidz.currentJuz) {
    lines.push(`✨ Tahfidz: Juz ${data.tahfidz.currentJuz} (${data.tahfidz.currentJuzPercent}%), +${data.tahfidz.ayatBaru} ayat bulan ini`)
  }
  if (data.tahfidz.promotions.length > 0) {
    lines.push(`🏆 Juz selesai: ${data.tahfidz.promotions.map(p => `Juz ${p.juz}`).join(', ')}`)
  }
  lines.push(`📅 Kehadiran: ${data.attendance.activeDays} hari aktif`)
  return lines.join('\n')
}

export default async function GuruRaporPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const sp = await searchParams

  const allowed = await canTeacherAccessStudent(session.teacherId, id)
  if (!allowed) redirect('/guru/siswa')

  const now = new Date()
  const year = parseInt(sp.year ?? '', 10) || now.getFullYear()
  const month = parseInt(sp.month ?? '', 10) || (now.getMonth() + 1)

  const data = await getStudentRaporData(id, year, month)
  if (!data) notFound()

  // Navigasi bulan
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // Link publik tokenized
  const token = await createRaporToken({ sid: id, y: year, m: month })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const raporUrl = `${baseUrl}/rapor/${token}`

  return (
    <div className="min-h-screen" style={{ background: '#fafaf7' }}>
      <div className="print:hidden">
        <TeacherHeader fullName={session.fullName} active="siswa" />
      </div>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="print:hidden">
          <Link href={`/guru/siswa/${id}`} className="text-xs text-muted-foreground hover:underline">← Detail Siswa</Link>
        </div>

        {/* Toolbar: pilih bulan + share */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/guru/siswa/${id}/rapor?year=${prev.y}&month=${prev.m}`}
              className="w-8 h-8 rounded-md border bg-white flex items-center justify-center hover:bg-muted"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold min-w-[140px] text-center">{data.period.monthLabel}</span>
            <Link
              href={isCurrentMonth ? '#' : `/guru/siswa/${id}/rapor?year=${next.y}&month=${next.m}`}
              className={`w-8 h-8 rounded-md border bg-white flex items-center justify-center ${isCurrentMonth ? 'opacity-40 pointer-events-none' : 'hover:bg-muted'}`}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <RaporShareButton
            studentName={data.student.full_name}
            waliName={data.student.wali_name}
            waliPhone={data.student.wali_phone}
            monthLabel={data.period.monthLabel}
            summary={buildSummary(data)}
            raporUrl={raporUrl}
          />
        </div>

        {!data.student.wali_phone && (
          <div className="print:hidden rounded-lg border px-4 py-2.5 text-xs" style={{ background: '#fef9c3', borderColor: '#fde68a', color: '#a16207' }}>
            ⚠ No. HP wali belum diisi — tombol WA akan membuka share umum. Tambahkan no. wali di data siswa (admin) untuk kirim langsung.
          </div>
        )}

        {/* Dokumen rapor */}
        <RaporDocument data={data} />
      </main>
    </div>
  )
}
