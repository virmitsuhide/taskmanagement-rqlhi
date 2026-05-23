import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canPostToHome } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PublicPostForm } from './PublicPostForm'

export default async function BuatHomePostPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPostToHome(session.role)) redirect('/home-post')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Buat Post Publik"
        breadcrumbs={[{ label: 'Home Publik', href: '/home-post' }, { label: 'Buat Post' }]}
      />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/home-post"><ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Manajemen Home</Link>
        </Button>
        <h1 className="text-xl font-bold mb-6">Buat Post Publik</h1>
        <PublicPostForm />
      </div>
    </div>
  )
}
