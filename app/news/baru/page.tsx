import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { NewsForm } from './NewsForm'

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

export default async function BuatBeritaPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canCreateNews(session.role)) redirect('/news')

  return (
    <div className={playfair.variable}>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Buat Berita"
        breadcrumbs={[{ label: 'Berita', href: '/news' }, { label: 'Buat Berita' }]}
      />
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/news">
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali ke Daftar Berita
          </Link>
        </Button>
        <h1
          className="text-2xl md:text-3xl font-bold mb-1.5 tracking-tight"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Buat Berita Baru
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Berita akan langsung tampil di halaman publik dan carousel homepage.
        </p>
        <NewsForm />
      </div>
    </div>
  )
}
