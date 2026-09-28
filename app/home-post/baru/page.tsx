import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canPostPengumuman, canPostToHome, canPostTugasGuru } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PublicPostForm } from './PublicPostForm'

export default async function BuatHomePostPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPostToHome(session.role)) redirect('/home-post')

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Buat Pengumuman"
        breadcrumbs={[{ label: "Pengumuman Guru Qur'an", href: '/home-post' }, { label: 'Buat Post' }]}
        ownH1
      />
      {/* Kanvas bertint supaya kartu form punya kontras di mode terang. */}
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href="/home-post"><ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Pengumuman Guru Qur&apos;an</Link>
          </Button>
          <h1 className="text-3xl mb-1">Buat Pengumuman</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Tampil di beranda publik dan di dashboard guru Qur&apos;an sesuai sasarannya.
          </p>
          <PublicPostForm izin={{ pengumuman: canPostPengumuman(session.role), tugas_guru: canPostTugasGuru(session.role) }} />
        </div>
      </div>
    </div>
  )
}
