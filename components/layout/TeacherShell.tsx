import { punyaSlotEkstra } from '@/lib/data/ekstra'
import {
  LayoutDashboard, Users, BookOpen, Sparkles, CalendarCheck,
  BarChart3, ScrollText, GraduationCap, IdCard, ClipboardCheck, ListChecks,
  Table2, HeartHandshake, UserCheck,
  FileText, CalendarHeart, Play, PieChart,
} from 'lucide-react'
import { cookies } from 'next/headers'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { TeacherNav, type TeacherNavGroup } from './TeacherNav'
import { COOKIE_SIDEBAR_CIUT } from './sidebar-ciut-cookie'
import { PengumumanBell } from '@/components/guru/PengumumanBell'
import { getKonteksPengumuman, getPengumumanGuru } from '@/lib/data/pengumuman-guru'
import { hitungRaporBaruGuru } from '@/lib/data/kpi-pengesahan'
import { getNotifUjianGuru } from '@/lib/data/ujian-notifikasi'
import { kelompokPengampu } from '@/lib/data/riyadhoh'

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

  const [bolehGukar, unitUjian, konteks, raporBaru, notifUjian, kue, riyadhoh, pengampuEkstra] = await Promise.all([
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
    cookies(),
    // Pengampu Riyadhoh Sabtu (0087) — hanya guru yang ditetapkan koordinator SMP.
    kelompokPengampu(session.teacherId),
    // Pengampu slot ekstra (0091) — menu Ekstra hanya untuk mereka.
    punyaSlotEkstra(session.teacherId).catch(() => false),
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
        // Daftar hadir mendahului setoran: yang pertama dilakukan saat pertemuan
        // dimulai adalah melihat siapa yang datang (0081).
        // Satu layar yang merangkai hadir → setor → catatan untuk sesi yang sedang berjalan.
        { label: 'Mulai Sesi', href: '/guru/sesi', icon: <Play /> },
        { label: 'Daftar Hadir', href: '/guru/absensi', icon: <UserCheck /> },
        { label: 'Setor Tahsin', href: '/guru/setoran/tahsin/baru', icon: <BookOpen /> },
        { label: 'Setor Tahfidz', href: '/guru/setoran/tahfidz/baru', icon: <Sparkles /> },
        // Satu sesi sekaligus — cara yang lebih cepat saat seluruh halaqoh setor.
        // Dipisah per jenis, bukan satu tautan: tahsin dan tahfidz punya halaman
        // sendiri dengan isian yang berbeda, jadi satu menu pasti menyembunyikan
        // salah satunya — dan yang tersembunyi selama ini tahfidz, yang halamannya
        // sudah ada tapi tak punya jalan masuk dari navigasi.
        { label: 'Sesi Tahsin', href: '/guru/setoran/tahsin/sesi', icon: <ListChecks /> },
        { label: 'Sesi Tahfidz', href: '/guru/setoran/tahfidz/sesi', icon: <ListChecks /> },
        { label: 'Rekap Kehadiran', href: '/guru/absensi/rekap', icon: <Table2 /> },
        { label: 'Progres per Sesi', href: '/guru/progres', icon: <Table2 /> },
        { label: 'Catatan Adab', href: '/guru/adab', icon: <HeartHandshake /> },
        { label: 'Capaian Bulanan', href: '/guru/capaian', icon: <CalendarCheck /> },
        // Sebaran capaian seluruh halaqoh di unit guru — jumlah saja, tanpa nama siswa.
        { label: 'Capaian Unit', href: '/guru/capaian-unit', icon: <PieChart /> },
        // Laporan per SESI untuk grup wali; rapor per anak ada di halaman siswa.
        { label: 'Laporan Orang Tua', href: '/guru/laporan-ortu', icon: <FileText /> },
        // Rapor semester memakai format yang ditetapkan koordinator (0082).
        { label: 'Rapor Qur’an', href: '/guru/rapor-quran', icon: <ScrollText /> },
        ...(riyadhoh.length > 0 ? [{ label: 'Riyadhoh Sabtu', href: '/guru/riyadhoh', icon: <CalendarHeart /> }] : []),
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
        ...(pengampuEkstra ? [{ label: 'Ekstra', href: '/guru/ekstra', icon: <CalendarHeart /> }] : []),
        ...(bolehGukar ? [{ label: 'Pembinaan Gukar', href: '/guru/gukar', icon: <GraduationCap /> }] : []),
        { label: 'Profil Saya', href: '/guru/profil', icon: <IdCard /> },
      ],
    },
  ]

  return (
    <TeacherNav
      fullName={session.fullName}
      groups={groups}
      ciutAwal={kue.get(COOKIE_SIDEBAR_CIUT)?.value === '1'}
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
