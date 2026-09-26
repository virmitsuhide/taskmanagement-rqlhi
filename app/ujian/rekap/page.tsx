import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewUjian } from '@/lib/auth/permissions'

/**
 * Rekap Hasil publik dihapus karena memuat nama lengkap siswa. Alamat lama
 * (tautan tersimpan, WA) diteruskan: pengurus ke Riwayat & Rekap Ujian
 * dengan bulan yang sama, pengunjung lain ke antrian ujian.
 */
export default async function RekapUjianLamaPage({ searchParams }: {
  searchParams: Promise<{ bulan?: string; tahun?: string }>
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams])
  if (session && canViewUjian(session.role)) {
    const q = new URLSearchParams()
    if (sp.bulan) q.set('bulan', sp.bulan)
    if (sp.tahun) q.set('tahun', sp.tahun)
    redirect(`/ujian/riwayat${q.size ? `?${q}` : ''}`)
  }
  redirect('/ujian')
}
