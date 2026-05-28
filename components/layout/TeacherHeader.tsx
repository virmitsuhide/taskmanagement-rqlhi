import Link from 'next/link'
import { logoutTeacherAction } from '@/app/actions/teacher-auth'
import { Button } from '@/components/ui/button'

interface Props {
  fullName: string
  active?: 'dashboard' | 'setoran' | 'siswa' | 'jadwal' | 'rapor'
}

const NAV: { key: Props['active']; label: string; href: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/guru' },
  { key: 'siswa', label: 'Siswa', href: '/guru/siswa' },
  { key: 'setoran', label: 'Setoran', href: '/guru/setoran/tahsin/baru' },
]

export function TeacherHeader({ fullName, active }: Props) {
  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3 border-b sticky top-0 z-10"
      style={{ background: 'white', borderColor: '#e7e3da' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/guru"
          className="font-extrabold text-base md:text-lg tracking-tight shrink-0"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          RQ <span style={{ color: '#b8860b' }}>LHI</span>
        </Link>
        <span
          className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border shrink-0"
          style={{ borderColor: '#f0e0a8', background: '#fdf6e3', color: '#b8860b' }}
        >
          Portal Guru
        </span>
        <nav className="hidden md:flex gap-1">
          {NAV.map(item => (
            <Link
              key={item.key}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={
                active === item.key
                  ? { background: '#f3f1ec', color: '#1a1a1a', fontWeight: 500 }
                  : { color: '#6b6b6b' }
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
