import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherStudents } from '@/lib/data/teacher'
import { Users } from 'lucide-react'
import { StudentBrowser } from './StudentBrowser'

export default async function GuruSiswaPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const students = await getTeacherStudents(session.teacherId)
  const halaqohCount = new Set(students.map(s => s.halaqoh_id ?? 'none')).size

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Siswa Saya
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {students.length} siswa di {halaqohCount} halaqoh
          </p>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">Belum ada siswa</p>
            <p className="text-xs text-muted-foreground mt-1">
              Anda belum ditugaskan sebagai wali/pengampu halaqoh manapun.
              Hubungi admin untuk assign halaqoh.
            </p>
          </div>
        ) : (
          /*
            Penyaringan & pengelompokan dikerjakan di peramban, bukan lewat URL:
            seorang pengampu memegang puluhan siswa, bukan ribuan, dan berpindah
            antar pengelompokan jadi seketika tanpa memuat ulang halaman.
          */
          <StudentBrowser students={students} />
        )}
      </div>
    </div>
  )
}
