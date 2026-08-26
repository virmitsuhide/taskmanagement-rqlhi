import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageStudents, getManageableJenjang } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ImportSiswa } from './ImportSiswa'

export default async function ImportStudentsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowed = getManageableJenjang(session.role).filter(j => canManageStudents(session.role, j))
  if (allowed.length === 0) redirect('/siswa')

  // Rujukan yang sama persis dengan formulir satuan — berkas contoh dan
  // pemeriksaan baris keduanya dibangun dari daftar ini, jadi apa yang boleh
  // ditulis di Excel selalu sama dengan apa yang muncul di dropdown.
  const supabase = createServerClient()
  const [halaqohResult, methodsResult, jilidResult] = await Promise.all([
    supabase.from('halaqoh').select('id, name, jenjang').eq('is_active', true).order('name'),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num').order('order_num'),
  ])

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Siswa', href: '/siswa' }, { label: 'Impor Excel' }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Impor Siswa dari Excel</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Kolomnya sama dengan formulir Tambah Siswa. Unggah dulu, periksa hasilnya, baru simpan.
        </p>
        <ImportSiswa
          allowedJenjang={allowed}
          halaqohList={halaqohResult.data ?? []}
          methods={methodsResult.data ?? []}
          jilidLevels={jilidResult.data ?? []}
        />
      </div>
    </div>
  )
}
