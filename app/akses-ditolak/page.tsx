import Link from 'next/link'
import { Home, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { DEFAULT_DASHBOARD, ROLE_LABELS } from '@/lib/auth/permissions'

export const metadata = { title: 'Tidak punya akses — RQ LHI' }

interface PageProps {
  searchParams: Promise<{ dari?: string }>
}

/**
 * Tujuan lib/auth/tolak-akses.ts. Menjawab tiga pertanyaan orang yang baru
 * ditolak: akun mana yang sedang saya pakai, kenapa ditolak, dan ke mana
 * sekarang. Bukan galat sistem — tidak ada yang rusak, jadi nadanya tenang.
 */
export default async function AksesDitolakPage({ searchParams }: PageProps) {
  const { dari } = await searchParams
  // Hanya jalur di aplikasi ini yang ditampilkan — nilai dari URL tidak dipercaya.
  const halaman = dari && /^\/(?![/\\])/.test(dari) ? dari : null
  const [pengurus, guru] = await Promise.all([getSession(), getTeacherSession().catch(() => null)])

  const akun = pengurus
    ? { nama: pengurus.displayName, peran: ROLE_LABELS[pengurus.role] ?? pengurus.role, beranda: `/dashboard/${DEFAULT_DASHBOARD[pengurus.role]}` }
    : guru
      ? { nama: guru.fullName, peran: 'Guru', beranda: '/guru' }
      : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-warning-wash text-warning">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-3xl tracking-tight">Halaman ini bukan untuk akun Anda</h1>
        <p className="text-sm text-muted-foreground">
          {akun
            ? <>Anda masuk sebagai <span className="font-medium text-foreground">{akun.nama}</span> ({akun.peran}). </>
            : 'Anda belum masuk. '}
          Setiap peran hanya membuka menu yang terkait tugasnya — misalnya koordinator unit
          hanya melihat data unitnya sendiri.
        </p>

        {halaman && (
          <p className="mx-auto mt-4 max-w-sm rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Bila Anda memang perlu membukanya, hubungi admin RQ dan sebutkan alamat ini:{' '}
            <span className="break-all font-mono text-foreground">{halaman}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild size="sm" className="gap-1.5">
            <Link href={akun?.beranda ?? '/login'}>
              <Home className="h-3.5 w-3.5" />
              {akun ? 'Kembali ke beranda saya' : 'Masuk'}
            </Link>
          </Button>
          {akun && (
            <Button asChild size="sm" variant="outline">
              <Link href={akun.beranda === '/guru' ? '/login' : '/guru/login'}>Masuk dengan akun lain</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
