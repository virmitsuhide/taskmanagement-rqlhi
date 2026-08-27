import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh } from '@/lib/auth/permissions'
import { muatLingkupKelompokUntukSesi } from '@/app/actions/pindah-halaqoh'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ImportKelompok } from './ImportKelompok'

export default async function ImporKelompokPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageHalaqoh(session.role)) redirect('/halaqoh')

  // Lingkupnya dibangun oleh fungsi yang SAMA dengan yang dipakai server saat
  // menyimpan. Kalau layar ini menyusun daftarnya sendiri, pratinjau bisa
  // menyatakan 400 baris siap dipindah sementara server menolak separuhnya.
  const lingkup = await muatLingkupKelompokUntukSesi()
  if (lingkup.halaqohList.length === 0) redirect('/halaqoh')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Halaqoh', href: '/halaqoh' }, { label: 'Impor Kelompok' }]}
        showBack
      />
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <h1 className="mb-1 text-2xl font-bold leading-tight">Impor Pembagian Kelompok</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Untuk pembagian ulang yang jumlahnya banyak — satu lembar per sesi. Berkas ini
          hanya memindahkan santri antar halaqoh; identitasnya tidak diubah, dan halaqoh
          baru tetap harus dibuat lebih dulu.
        </p>
        <ImportKelompok halaqohList={lingkup.halaqohList} santri={lingkup.santri} />
      </div>
    </div>
  )
}
