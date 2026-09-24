import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canPostToHome } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PublicPostForm } from '../../baru/PublicPostForm'
import type { PublicPost } from '@/types'

/** Sunting post beranda — hanya pembuatnya, seperti menyembunyikan & menghapus. */
export default async function EditHomePostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canPostToHome(session.role)) redirect('/home-post')

  const { id } = await params
  const { data } = await createServerClient().from('public_posts').select('*').eq('id', id).maybeSingle()
  const post = data as PublicPost | null
  if (!post) notFound()
  if (post.created_by !== session.userId) redirect('/home-post')

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Sunting Post"
        breadcrumbs={[{ label: 'Home Publik', href: '/home-post' }, { label: 'Sunting Post' }]}
        ownH1
      />
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href="/home-post"><ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Manajemen Home</Link>
          </Button>
          <h1 className="text-xl font-bold mb-1">Sunting Post</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Perubahan langsung tampil di beranda publik setelah disimpan.
          </p>
          <PublicPostForm post={post} />
        </div>
      </div>
    </div>
  )
}
