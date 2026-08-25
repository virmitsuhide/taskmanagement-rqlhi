import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canRequestToHumas, canViewHumasRequests } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { ContentRequestCard } from '@/components/humas/ContentRequestCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, ArrowRight } from 'lucide-react'
import { requestStatus } from '@/lib/humas/request-status'
import type { ContentRequest } from '@/types'

export default async function HumasRequestPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHumasRequests(session.role)) redirect('/dashboard')

  const supabase = createServerClient()
  const query = supabase
    .from('content_requests')
    .select('*, requester:users!requested_by(id, display_name, role), task:tasks!task_id(id, status, priority, problem_type, assigned_to, assigned_by)')
    .order('created_at', { ascending: false })

  // Humas sees all; others see only their own
  if (session.role !== 'humas' && session.role !== 'kepala_rq') {
    query.eq('requested_by', session.userId)
  }

  const { data } = await query
  const requests = (data ?? []) as ContentRequest[]

  // Status dibaca lewat requestStatus(), bukan r.status: sejak 0033 tugaslah
  // pemegang kemajuan, dan kolom status lama tidak lagi ditulis.
  const active = requests.filter(r => requestStatus(r) !== 'finish')
  const finished = requests.filter(r => requestStatus(r) === 'finish')

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Request ke Humas" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
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
                  {/*
                    Tombol "Mulai Proses" & "Tandai Selesai" sudah tidak ada di
                    sini. Kemajuan dipindahkan sepenuhnya ke papan tugas, jadi
                    halaman ini murni jendela pemantauan — dua tempat yang
                    sama-sama bisa mengubah status adalah cara tercepat membuat
                    keduanya berbeda isi.
                  */}
                  {req.task && (
                    <div className="px-1">
                      <Link
                        href={`/tasks/${req.task.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Buka tugasnya di papan
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
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
