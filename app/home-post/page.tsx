import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canPostToHome } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { togglePublicPostAction, deletePublicPostAction } from '@/app/actions/public-posts'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { PublicPost } from '@/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TYPE_LABELS: Record<string, string> = {
  pengumuman: 'Pengumuman',
  tugas_guru: 'Tugas Guru',
}

export default async function HomePostPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPostToHome(session.role)) redirect('/dashboard')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('public_posts')
    .select('*, creator:users!public_posts_created_by_fkey(id, display_name)')
    .order('created_at', { ascending: false })

  // Filter: kepala_rq sees all, others see only their own
  const allPosts = (data ?? []) as PublicPost[]
  const posts = session.role === 'kepala_rq'
    ? allPosts
    : allPosts.filter(p => p.created_by === session.userId)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Manajemen Home Publik" />
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{posts.length} post</p>
          <Button asChild size="sm">
            <Link href="/home-post/baru"><Plus className="h-4 w-4 mr-1" />Buat Post</Link>
          </Button>
        </div>

        {posts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p>Belum ada post.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/home-post/baru">Buat Post Pertama</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <Card key={post.id} className={!post.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">{TYPE_LABELS[post.type]}</Badge>
                        {post.target !== 'all' && (
                          <Badge variant="outline" className="text-xs">{post.target.toUpperCase()}</Badge>
                        )}
                        {!post.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Nonaktif</Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-sm">{post.title}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(post.created_at)}</p>
                    </div>
                    <div className="flex gap-1">
                      <form action={togglePublicPostAction.bind(null, post.id, !post.is_active) as unknown as (fd: FormData) => void}>
                        <Button size="sm" variant="ghost" type="submit" className="h-8 w-8 p-0">
                          {post.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </form>
                      <form action={deletePublicPostAction.bind(null, post.id) as unknown as (fd: FormData) => void}>
                        <Button size="sm" variant="ghost" type="submit" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
