import {
  LayoutDashboard, Users, BookOpen, Sparkles, CalendarCheck,
  BarChart3, ScrollText, GraduationCap, IdCard, ClipboardCheck, ListChecks,
  Table2, HeartHandshake,
} from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { TeacherNav, type TeacherNavGroup } from './TeacherNav'
import { PengumumanBell } from '@/components/guru/PengumumanBell'
import { getKonteksPengumuman, getPengumumanGuru } from '@/lib/data/pengumuman-guru'
import { hitungRaporBaruGuru } from '@/lib/data/kpi-pengesahan'
import { getNotifUjianGuru } from '@/lib/data/ujian-notifikasi'

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

  const [bolehGukar, unitUjian, konteks, raporBaru, notifUjian] = await Promise.all([
    bolehMengampuGukar(session.teacherId),
    getUnitUjianGuru(session.teacherId),
    getKonteksPengumuman(session.teacherId),
    // Lencana rapor KPI dihitung per baris, bukan lewat satu penanda waktu
    // seperti pengumuman. Guru perlu tahu rapor BULAN MANA yang baru, dan
    // penanda tunggal padam begitu ia membuka daftarnya — termasuk ketika yang
    // ia buka bukan rapor yang dimaksud.
    hitungRaporBaruGuru(session.teacherId),
    // Kabar pengajuan ujian (dijadwalkan/selesai) — ikut lonceng dan lencana
    // menu Pengajuan Ujian.
    getNotifUjianGuru(session.teacherId),
  ])

  // Diambil di kerangka, bukan di tiap halaman: loncengnya ada di bilah atas
  // yang melekat di semua halaman portal, jadi datanya harus ikut ke mana pun.
  const pengumuman = await getPengumumanGuru(konteks.unit, konteks.seenAt)

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
        // Satu sesi sekaligus — cara yang lebih cepat saat seluruh halaqoh setor.
        // Dipisah per jenis, bukan satu tautan: tahsin dan tahfidz punya halaman
        // sendiri dengan isian yang berbeda, jadi satu menu pasti menyembunyikan
        // salah satunya — dan yang tersembunyi selama ini tahfidz, yang halamannya
        // sudah ada tapi tak punya jalan masuk dari navigasi.
        { label: 'Sesi Tahsin', href: '/guru/setoran/tahsin/sesi', icon: <ListChecks /> },
        { label: 'Sesi Tahfidz', href: '/guru/setoran/tahfidz/sesi', icon: <ListChecks /> },
        { label: 'Progres per Sesi', href: '/guru/progres', icon: <Table2 /> },
        { label: 'Catatan Adab', href: '/guru/adab', icon: <HeartHandshake /> },
        { label: 'Capaian Bulanan', href: '/guru/capaian', icon: <CalendarCheck /> },
        { label: 'Statistik', href: '/guru/statistik', icon: <BarChart3 /> },
      ],
    },
    {
      title: 'Kinerja Saya',
      items: [
        { label: 'Rapor KPI', href: '/guru/rapor-kpi', icon: <ClipboardCheck />, badge: raporBaru },
      ],
    },
    {
      title: 'Lainnya',
      items: [
        ...(unitUjian
          ? [{ label: 'Pengajuan Ujian', href: '/guru/ujian', icon: <ScrollText />, badge: notifUjian.baruCount }]
          : []),
        ...(bolehGukar ? [{ label: 'Pembinaan Gukar', href: '/guru/gukar', icon: <GraduationCap /> }] : []),
        { label: 'Profil Saya', href: '/guru/profil', icon: <IdCard /> },
      ],
    },
  ]

  return (
    <TeacherNav
      fullName={session.fullName}
      groups={groups}
      bell={
        <PengumumanBell
          items={pengumuman.items}
          barusanCount={pengumuman.barusanCount}
          ujian={notifUjian.items}
          ujianBaru={notifUjian.baruCount}
        />
      }
    >
      {children}
    </TeacherNav>
  )
}
