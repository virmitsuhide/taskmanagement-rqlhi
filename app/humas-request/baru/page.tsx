import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canRequestToHumas } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ContentRequestForm } from './ContentRequestForm'

export default async function BuatHumasRequestPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canRequestToHumas(session.role)) redirect('/humas-request')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Request Konten ke Humas"
        breadcrumbs={[{ label: 'Request Humas', href: '/humas-request' }, { label: 'Request Baru' }]}
        ownH1
      />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/humas-request"><ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Daftar Request</Link>
        </Button>
        <h1 className="text-xl font-bold mb-6">Request Konten ke Humas</h1>
        <ContentRequestForm />
      </div>
    </div>
  )
}
