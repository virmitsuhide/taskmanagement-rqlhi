import { redirect } from 'next/navigation'
import { Lock, LogOut } from 'lucide-react'
import { getEmployeeSession } from '@/lib/auth/employee-session'
import { createServerClient } from '@/lib/supabase/server'
import { logoutEmployeeAction } from '@/app/actions/employee-auth'
import { GuruProfileForm } from '@/components/profil/GuruProfileForm'
import { KOLOM_PROFIL_KARYAWAN } from '@/lib/data/pengurus'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { TEACHER_EMPLOYMENT_LABELS } from '@/types'
import type { EmployeeProfile } from '@/types'

/**
 * Portal Karyawan — satu halaman, hanya profil.
 *
 * Karyawan RQ tidak mengampu halaqoh, tidak menyetor hafalan, dan tidak dinilai
 * KPI, jadi portalnya tidak punya menu: yang bisa ia lakukan cuma melengkapi
 * data dirinya. Menambahkan bilah navigasi berisi satu tautan ke halaman yang
 * sedang dibuka hanya akan menyiratkan ada tempat lain yang bisa dituju.
 */
export default async function ProfilKaryawanPage() {
  const session = await getEmployeeSession()
  if (!session) redirect('/karyawan/login')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('employees')
    .select(KOLOM_PROFIL_KARYAWAN)
    .eq('id', session.employeeId)
    .maybeSingle()

  if (!data) redirect('/karyawan/login')
  const profile = data as unknown as EmployeeProfile

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo variant="mark" size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.fullName}</p>
              <p className="text-xs text-muted-foreground">Portal Karyawan</p>
            </div>
          </div>
          <form action={logoutEmployeeAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="mr-1.5 h-4 w-4" />
              Keluar
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Profil Saya
        </h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Lengkapi data diri Anda. Isian ini dipakai untuk arsip kepegawaian RQ.
        </p>

        {/* Terlihat tapi terkunci — kalau ada yang keliru, ia perlu melihatnya
            untuk bisa melaporkannya. */}
        <section className="mb-6 rounded-xl border bg-muted/30 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Dikelola admin — sampaikan bila ada yang keliru
          </p>
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Baris label="Nama lengkap" value={profile.full_name} />
            <Baris label="Jabatan" value={profile.jabatan ?? '—'} />
            <Baris label="NIP" value={profile.nip ?? '—'} />
            <Baris
              label="Jenis kepegawaian"
              value={profile.employment_type ? TEACHER_EMPLOYMENT_LABELS[profile.employment_type] : '—'}
            />
          </div>
        </section>

        <GuruProfileForm profile={profile} scope="karyawan" />
      </div>
    </div>
  )
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex gap-2">
      <span className="w-[130px] shrink-0 text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">:</span>
      <span className="min-w-0 flex-1 font-medium">{value}</span>
    </p>
  )
}
