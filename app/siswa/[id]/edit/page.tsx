import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageStudents, getManageableJenjang } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { StudentForm } from '../../baru/StudentForm'
import type { Jenjang, Gender } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditStudentPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerClient()
  const { data: student } = await supabase
    .from('students')
    .select('id, nis, full_name, gender, birth_date, jenjang, kelas, halaqoh_id, wali_name, wali_phone, wali_email, current_method_id, current_jilid_id, current_jilid_page, is_active')
    .eq('id', id)
    .maybeSingle()

  if (!student) notFound()
  if (!canManageStudents(session.role, student.jenjang as Jenjang)) redirect(`/siswa/${id}`)

  const [halaqohResult, methodsResult, jilidResult] = await Promise.all([
    supabase.from('halaqoh').select('id, name, jenjang').order('name'),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num').order('order_num'),
  ])

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[
          { label: 'Siswa', href: '/siswa' },
          { label: student.full_name, href: `/siswa/${id}` },
          { label: 'Edit' },
        ]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Edit Siswa</h1>
        <p className="text-sm text-muted-foreground mb-6">{student.full_name}</p>
        <StudentForm
          mode="edit"
          allowedJenjang={getManageableJenjang(session.role)}
          halaqohList={halaqohResult.data ?? []}
          methods={methodsResult.data ?? []}
          jilidLevels={jilidResult.data ?? []}
          initial={{
            id: student.id,
            nis: student.nis,
            full_name: student.full_name,
            gender: student.gender as Gender | null,
            birth_date: student.birth_date,
            jenjang: student.jenjang as Jenjang,
            kelas: student.kelas,
            halaqoh_id: student.halaqoh_id,
            wali_name: student.wali_name,
            wali_phone: student.wali_phone,
            wali_email: student.wali_email,
            current_method_id: student.current_method_id,
            current_jilid_id: student.current_jilid_id,
            current_jilid_page: student.current_jilid_page,
            is_active: student.is_active,
          }}
        />
      </div>
    </div>
  )
}
