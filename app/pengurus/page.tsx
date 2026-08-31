import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManagePengurus } from '@/lib/auth/permissions'
import { getDaftarJabatan, getCalonPengurus } from '@/lib/data/pengurus'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { JabatanRow } from './JabatanRow'

/**
 * Pengurus — kepala RQ menetapkan siapa menduduki jabatan apa. Khusus kepala RQ.
 *
 * Halaman ini adalah satu-satunya tempat "Amanah Saat Ini" ditentukan. Sebelum
 * ada halaman ini, tiap pengurus mengetik sendiri nama jabatannya di /profil —
 * teks bebas yang tidak terhubung ke apa pun, dan yang tetap menyebut nama
 * pejabat lama setelah kursinya berpindah tangan.
 */
export default async function PengurusPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManagePengurus(session.role)) redirect('/dashboard')

  const [jabatan, calon] = await Promise.all([getDaftarJabatan(), getCalonPengurus()])

  const terisi = jabatan.filter(j => j.pemegang).length
  const kosong = jabatan.length - terisi

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Pengurus" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight">Pengurus RQ LHI</h1>
        <p className="text-sm text-muted-foreground mt-0.5 mb-5">
          {terisi} jabatan terisi
          {kosong > 0 && ` · ${kosong} masih kosong`} · {calon.length} nama tersedia
        </p>

        <div className="mb-5 flex gap-3 rounded-xl border border-info/30 bg-info-wash px-4 py-3">
          <UsersRound className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div className="text-xs leading-relaxed text-info">
            <p className="font-semibold">Menetapkan nama di sini memindahkan profilnya sekaligus.</p>
            <p className="mt-1 text-info/90">
              Akun jabatan tidak menyimpan data diri sendiri. Begitu sebuah nama ditetapkan, halaman
              Profil pada akun itu membaca data diri, pendidikan, kompetensi, dan riwayat dari{' '}
              <b>rekam guru</b> orang tersebut — jadi saat kursi berpindah tangan, profilnya ikut
              berpindah tanpa perlu diketik ulang. Nama di akun pun ikut diperbarui.
            </p>
            <p className="mt-1 text-info/90">
              Pilihan namanya terbatas pada <b>guru tetap yayasan</b> dan <b>guru kontrak yayasan</b>.
              Satu orang hanya boleh memegang satu jabatan.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {jabatan.map(baris => (
            <JabatanRow key={baris.role} baris={baris} calon={calon} />
          ))}
        </div>
      </div>
    </div>
  )
}
