import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { logoutTeacherAction } from '@/app/actions/teacher-auth'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'

interface Props {
  fullName: string
  active?: 'dashboard' | 'setoran' | 'tahfidz' | 'siswa' | 'statistik' | 'jadwal' | 'rapor' | 'gukar' | 'capaian'
}

const NAV: { key: Props['active']; label: string; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/guru' },
  { key: 'siswa', label: 'Siswa', href: '/guru/siswa' },
  { key: 'setoran', label: 'Setor Tahsin', href: '/guru/setoran/tahsin/baru' },
  { key: 'tahfidz', label: 'Setor Tahfidz', href: '/guru/setoran/tahfidz/baru' },
  { key: 'capaian', label: 'Capaian Bulanan', href: '/guru/capaian' },
  { key: 'statistik', label: 'Statistik', href: '/guru/statistik' },
]

/**
 * Menu yang hanya muncul bagi sebagian guru.
 *
 * Pembinaan gukar diampu guru Tetap Yayasan & Kontrak Yayasan saja, jadi
 * menunya disembunyikan dari yang lain. Ini semata kerapian tampilan —
 * penjagaan sesungguhnya ada di halaman dan di server action, sebab menu yang
 * tidak tampil sama sekali tidak menghalangi orang mengetik URL-nya.
 */
const NAV_GUKAR = { key: 'gukar' as const, label: 'Pembinaan Gukar', href: '/guru/gukar' }

export async function TeacherHeader({ fullName, active }: Props) {
  // Sesi dibaca ulang di sini, bukan dioper lewat prop, supaya belasan halaman
  // yang memakai header ini tidak perlu diubah satu per satu — dan tidak ada
  // satu pun yang bisa lupa mengopernya lalu diam-diam menampilkan menu itu.
  const session = await getTeacherSession()
  const nav = session && (await bolehMengampuGukar(session.teacherId))
    ? [...NAV, NAV_GUKAR]
    : NAV
  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3 border-b sticky top-0 z-10"
      style={{ background: 'white', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/guru"
          className="flex items-center gap-2 font-extrabold text-base md:text-lg tracking-tight shrink-0"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          <Logo size={32} alt="" />
          <span>RQ <span style={{ color: 'var(--primary)' }}>LHI</span></span>
        </Link>
        <span
          className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--primary-wash)', color: 'var(--primary)' }}
        >
          Portal Guru
        </span>
        <nav className="hidden md:flex gap-1">
          {nav.map(item => (
            <Link
              key={item.key}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={
                active === item.key
                  ? { background: '#f3f1ec', color: 'var(--foreground)', fontWeight: 500 }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[140px]">{fullName}</span>
        <form action={logoutTeacherAction}>
          <Button type="submit" variant="outline" size="sm">Keluar</Button>
        </form>
      </div>
    </header>
  )
}
