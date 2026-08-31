import { redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageEmployees } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { GuruProfileForm } from '@/components/profil/GuruProfileForm'
import { KOLOM_PROFIL_KARYAWAN } from '@/lib/data/pengurus'
import { EmployeeForm } from '../../baru/EmployeeForm'
import type { Employee, EmployeeProfile } from '@/types'

const KOLOM_AKUN =
  'id, username, full_name, jabatan, nip, email, phone, is_active, deleted_at,' +
  ' employment_type, joined_at, contract_start, contract_end'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new_password?: string }>
}

/**
 * Sunting karyawan — akun & kepegawaian di atas, data diri di bawah.
 *
 * Dipisah dua form karena keduanya beda wewenang sekaligus beda irama: akun
 * dan kepegawaian jarang berubah dan hanya boleh disentuh admin, sedangkan data
 * diri sering dilengkapi dan karyawannya sendiri juga bisa mengisinya dari
 * portal. Menyatukannya berarti satu tombol Simpan menulis dua hal yang tidak
 * pernah berubah bersamaan.
 */
export default async function SuntingKaryawanPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEmployees(session.role)) redirect('/dashboard')

  const { id } = await params
  const { new_password } = await searchParams

  const supabase = createServerClient()
  const [akun, profil] = await Promise.all([
    supabase.from('employees').select(KOLOM_AKUN).eq('id', id).maybeSingle(),
    supabase.from('employees').select(KOLOM_PROFIL_KARYAWAN).eq('id', id).maybeSingle(),
  ])

  if (!akun.data) redirect('/karyawan')
  const employee = akun.data as unknown as Employee
  const profile = profil.data as unknown as EmployeeProfile

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Karyawan', href: '/karyawan' }, { label: employee.full_name }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{employee.full_name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">@{employee.username}</p>
        </div>

        {/*
          Password baru tampil sekali, di sini, lalu hilang untuk selamanya —
          yang tersimpan di database hash bcrypt, dan bcrypt satu arah.
        */}
        {new_password && (
          <div className="flex gap-3 rounded-xl border border-info/30 bg-info-wash px-4 py-3">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div className="text-xs leading-relaxed text-info">
              <p className="font-semibold">Akun dibuat. Salin passwordnya sekarang:</p>
              <p className="mt-1 font-mono text-sm font-bold">{new_password}</p>
              <p className="mt-1 text-info/90">
                Password ini tidak bisa ditampilkan lagi setelah halaman dimuat ulang.
              </p>
            </div>
          </div>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">Akun &amp; Kepegawaian</h2>
          <EmployeeForm mode="edit" initial={employee} />
        </section>

        {profile && (
          <section>
            <h2 className="mb-2 text-sm font-semibold">Data Diri</h2>
            <GuruProfileForm profile={profile} scope="karyawan-sdm" />
          </section>
        )}
      </div>
    </div>
  )
}
