import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canRequestToHumas } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateContentRequestStatusAction } from '@/app/actions/content-requests'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ContentRequestCard } from '@/components/humas/ContentRequestCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import type { ContentRequest } from '@/types'

export default async function HumasRequestPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const query = supabase
    .from('content_requests')
    .select('*, requester:users!content_requests_requested_by_fkey(id, display_name, role)')
    .order('created_at', { ascending: false })

  // Humas sees all; others see only their own
  if (session.role !== 'humas' && session.role !== 'kepala_rq') {
    query.eq('requested_by', session.userId)
  }

  const { data } = await query
  const requests = (data ?? []) as ContentRequest[]

  const active = requests.filter(r => r.status !== 'finish')
  const finished = requests.filter(r => r.status === 'finish')

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Request ke Humas" />
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{requests.length} request total</p>
          {canRequestToHumas(session.role) && (
            <Button asChild size="sm">
              <Link href="/humas-request/baru"><Plus className="h-4 w-4 mr-1" />Request Baru</Link>
            </Button>
          )}
        </div>

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">Aktif ({active.length})</TabsTrigger>
            <TabsTrigger value="finished" className="flex-1">Selesai ({finished.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada request aktif.</p>
            ) : (
              active.map(req => (
                <div key={req.id} className="space-y-2">
                  <ContentRequestCard request={req} />
                  <div className="flex gap-2 px-1">
                    {/* Humas: set on process */}
                    {session.role === 'humas' && req.status === 'requested' && (
                      <form action={updateContentRequestStatusAction.bind(null, req.id, 'on_process', undefined) as unknown as (fd: FormData) => void}>
                        <Button size="sm" variant="outline" type="submit">Mulai Proses</Button>
                      </form>
                    )}
                    {/* Requester: mark as finish */}
                    {req.requested_by === session.userId && req.status === 'on_process' && (
                      <form action={updateContentRequestStatusAction.bind(null, req.id, 'finish', undefined) as unknown as (fd: FormData) => void}>
                        <Button size="sm" type="submit">Tandai Selesai</Button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="finished" className="mt-4 space-y-3">
            {finished.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada request selesai.</p>
            ) : (
              finished.map(req => <ContentRequestCard key={req.id} request={req} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
