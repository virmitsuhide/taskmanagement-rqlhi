import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateNewsAction } from '@/app/actions/news'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { NewsForm } from '@/app/news/baru/NewsForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { NewsArticle } from '@/types'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditNewsPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canCreateNews(session.role)) redirect('/news')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('news_articles')
    .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
    .eq('id', id)
    .single()

  if (!data) notFound()
  const article = data as NewsArticle

  const boundAction = updateNewsAction.bind(null, id)

  return (
    <div className={playfair.variable}>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Edit Berita"
        breadcrumbs={[
          { label: 'Berita', href: '/news' },
          { label: article.title, href: `/news/${id}` },
          { label: 'Edit' },
        ]}
        ownH1
      />
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href={`/news/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Berita
          </Link>
        </Button>
        <h1
          className="text-2xl md:text-3xl font-bold mb-1.5 tracking-tight"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Edit Berita
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Perubahan akan langsung terlihat di halaman publik.
        </p>
        <NewsForm
          action={boundAction}
          defaultValues={article}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </div>
  )
}
