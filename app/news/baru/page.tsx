import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { NewsForm } from './NewsForm'

export default async function BuatBeritaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canCreateNews(session.role)) redirect('/news')

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Buat Berita" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/news"><ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Daftar Berita</Link>
        </Button>
        <h1 className="text-xl font-bold mb-1">Buat Berita Baru</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Berita akan langsung tampil di halaman publik dan carousel homepage.
        </p>
        <NewsForm />
      </div>
    </div>
  )
}
