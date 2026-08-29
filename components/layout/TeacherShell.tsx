import {
  LayoutDashboard, Users, BookOpen, Sparkles, CalendarCheck,
  BarChart3, ScrollText, GraduationCap, IdCard,
} from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { TeacherNav, type TeacherNavGroup } from './TeacherNav'

/**
 * Kerangka Portal Guru: navigasi tetap + wadah isi yang bisa digulung.
 *
 * Sesi dibaca di sini, bukan dioper dari tiap halaman. getTeacherSession()
 * dibungkus cache() (lihat lib/auth/teacher-session.ts), jadi halaman yang juga
 * memanggilnya tidak menambah satu pun perjalanan ke database.
 *
 * Dua menu hanya muncul untuk sebagian guru. Ini semata kerapian tampilan —
 * penjagaan sesungguhnya tetap ada di masing-masing halaman dan server action,
 * sebab menu yang tidak ditampilkan sama sekali tidak menghalangi siapa pun
 * mengetik alamatnya.
 */
export async function TeacherShell({ children }: { children: React.ReactNode }) {
  const session = await getTeacherSession()

  // /guru/login memakai layout yang sama tapi belum punya sesi. Penjagaan
  // aksesnya ada di proxy.ts, jadi di sini cukup dilewatkan tanpa kerangka —
  // halaman masuk tidak perlu menu yang belum boleh ia pakai.
  if (!session) return <>{children}</>

  const [bolehGukar, unitUjian] = await Promise.all([
    bolehMengampuGukar(session.teacherId),
    getUnitUjianGuru(session.teacherId),
  ])

  const groups: TeacherNavGroup[] = [
    {
      title: null,
      items: [
        { label: 'Dashboard', href: '/guru', icon: <LayoutDashboard />, exact: true },
        { label: 'Siswa Saya', href: '/guru/siswa', icon: <Users /> },
      ],
    },
    {
      title: 'Setoran & Capaian',
      items: [
        { label: 'Setor Tahsin', href: '/guru/setoran/tahsin/baru', icon: <BookOpen /> },
        { label: 'Setor Tahfidz', href: '/guru/setoran/tahfidz/baru', icon: <Sparkles /> },
        { label: 'Capaian Bulanan', href: '/guru/capaian', icon: <CalendarCheck /> },
        { label: 'Statistik', href: '/guru/statistik', icon: <BarChart3 /> },
      ],
    },
    {
      title: 'Lainnya',
      items: [
        ...(unitUjian ? [{ label: 'Pengajuan Ujian', href: '/guru/ujian', icon: <ScrollText /> }] : []),
        ...(bolehGukar ? [{ label: 'Pembinaan Gukar', href: '/guru/gukar', icon: <GraduationCap /> }] : []),
        { label: 'Profil Saya', href: '/guru/profil', icon: <IdCard /> },
      ],
    },
  ]

  return (
    <TeacherNav fullName={session.fullName} groups={groups}>
      {children}
    </TeacherNav>
  )
}
