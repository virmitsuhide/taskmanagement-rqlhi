import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Briefcase, KeyRound, UsersRound, ChevronRight, Lock } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { getDaftarJabatan } from '@/lib/data/pengurus'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop } from '@/components/dashboard/kit'

/**
 * Beranda akun admin. Admin bukan jabatan pengurus — tidak punya tugas,
 * rapat, maupun analitik — jadi berandanya cukup tiga pintu pengelolaan,
 * masing-masing dengan satu angka yang perlu diperhatikan.
 */
export default async function DashboardAdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'admin')) redirect('/dashboard')

  const supabase = createServerClient()
  const [jabatan, akun, guru, karyawan] = await Promise.all([
    getDaftarJabatan(),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('teachers').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true),
    supabase.from('employees').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true),
  ])
  const kosong = jabatan.filter(j => !j.pemegang).length

  const pintu = [
    {
      href: '/pengurus', icon: <UsersRound className="h-5 w-5" />, judul: 'Pengurus',
      ket: 'Tetapkan siapa yang menduduki tiap jabatan',
      angka: `${jabatan.length - kosong}/${jabatan.length}`, satuan: 'kursi terisi',
      waspada: kosong > 0 ? `${kosong} kursi masih kosong` : null,
    },
    {
      href: '/akun', icon: <KeyRound className="h-5 w-5" />, judul: 'Akun & Password',
      ket: 'Atur ulang password akun pengurus dan guru',
      angka: ((akun.count ?? 0) + (guru.count ?? 0)).toLocaleString('id-ID'), satuan: 'akun pengurus & guru',
      waspada: null,
    },
    {
      href: '/karyawan', icon: <Briefcase className="h-5 w-5" />, judul: 'Karyawan',
      ket: 'Data diri, kepegawaian, dan akun karyawan RQ',
      angka: (karyawan.count ?? 0).toLocaleString('id-ID'), satuan: 'karyawan aktif',
      waspada: null,
    },
  ]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Beranda Admin" />
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Admin sistem"
          title="Pengelolaan akun & orang"
          context={<>Akun ini terpisah dari jabatan pengurus — tidak ikut tugas, rapat, maupun analitik.</>}
          filters={null}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {pintu.map(p => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">{p.icon}</span>
                <h2 className="text-sm font-semibold">{p.judul}</h2>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-4 text-2xl font-bold leading-none">{p.angka}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.satuan}</p>
              {p.waspada && <p className="mt-2 text-xs font-medium text-warning">{p.waspada}</p>}
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{p.ket}</p>
            </Link>
          ))}
        </div>
        <Link
          href="/profil#ganti-password"
          className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Lock className="h-4 w-4 text-primary" />
          <span>
            <span className="font-semibold">Ganti password akun admin</span>
            <span className="block text-xs text-muted-foreground">
              Akun ini bisa mengganti password akun mana pun — pakai password yang kuat, bukan password awal.
            </span>
          </span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  )
}
