import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getChangelog } from '@/lib/data/changelog'
import { HalamanGuru } from '@/components/guru/HalamanGuru'
import { DaftarChangelog } from '@/components/changelog/DaftarChangelog'
import { TandaiPembaruanDibaca } from '@/components/changelog/PembaruanBaru'

/** Pembaruan Sistem (0121) untuk guru: kabar perubahan fitur dari Kepala RQ. */
export default async function PembaruanGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')
  const daftar = await getChangelog('guru')

  return (
    <HalamanGuru lebar="sedang" judul="Pembaruan Sistem" keterangan="Fitur baru, perubahan, dan perbaikan di portal guru.">
      <DaftarChangelog daftar={daftar} />
      <TandaiPembaruanDibaca pembaca="guru" terbaru={daftar?.[0]?.terbit_at ?? null} />
    </HalamanGuru>
  )
}
