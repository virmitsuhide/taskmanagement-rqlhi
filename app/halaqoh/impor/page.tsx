import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canManageHalaqoh, getManageableJenjang, getViewableProgramScope,
} from '@/lib/auth/permissions'
import { muatLingkupKelompokUntukSesi } from '@/app/actions/pindah-halaqoh'
import { programLabel } from '@/lib/rq/programs'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import type { SessionData } from '@/types'
import { ImportKelompok } from './ImportKelompok'

export default async function ImporKelompokPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageHalaqoh(session.role)) redirect('/halaqoh')

  // Lingkupnya dibangun oleh fungsi yang SAMA dengan yang dipakai server saat
  // menyimpan. Kalau layar ini menyusun daftarnya sendiri, pratinjau bisa
  // menyatakan 400 baris siap dipindah sementara server menolak separuhnya.
  const lingkup = await muatLingkupKelompokUntukSesi()

  // Lingkup kosong BUKAN alasan memulangkan orang diam-diam. Dulu baris ini
  // redirect('/halaqoh'), dan bagi koor QULS SD — yang lingkupnya menyempit
  // lewat program, bukan jenjang — layarnya jadi memantul tanpa sebab yang
  // kelihatan: tombolnya ada, diklik, kembali ke daftar. Yang membedakan
  // "Anda tak berwenang" dari "kelompoknya memang belum dibuat" harus
  // terbaca, karena jalan keluarnya berbeda jauh.
  if (lingkup.halaqohList.length === 0) {
    return (
      <Kerangka session={session}>
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Belum ada halaqoh yang bisa Anda isi</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
            {alasanKosong(session)}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/halaqoh/baru"><Plus className="mr-1 h-4 w-4" />Buat Halaqoh</Link>
          </Button>
        </div>
      </Kerangka>
    )
  }

  return (
    <Kerangka session={session}>
      <ImportKelompok halaqohList={lingkup.halaqohList} santri={lingkup.santri} />
    </Kerangka>
  )
}

/**
 * Kenapa daftarnya kosong, dikatakan dengan kata-kata orang yang membacanya.
 *
 * Untuk peran yang dipersempit per program, penyempitan itulah yang paling
 * mungkin menjadi sebabnya — dan menyebut nama programnya jauh lebih menolong
 * daripada kalimat umum "tidak ada data".
 */
function alasanKosong(session: SessionData): string {
  const jenjangList = getManageableJenjang(session.role)
  const programScope = jenjangList
    .map(j => (getViewableProgramScope(session.role, j) ?? []).map(p => programLabel(j, p)))
    .flat()

  if (programScope.length > 0) {
    const daftar = [...new Set(programScope)].join(' atau ')
    return `Wewenang Anda hanya mencakup halaqoh berprogram ${daftar}, dan belum ada satu pun ` +
      'yang dibuat. Berkas impor ini memindahkan santri antar kelompok yang sudah ada, ' +
      'jadi kelompoknya harus dibuat lebih dulu — pilih Program yang sesuai saat membuatnya.'
  }

  return 'Berkas impor ini memindahkan santri antar kelompok yang sudah ada, jadi kelompoknya ' +
    'harus dibuat lebih dulu lewat Buat Halaqoh.'
}

function Kerangka({ session, children }: { session: SessionData; children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  )
}
