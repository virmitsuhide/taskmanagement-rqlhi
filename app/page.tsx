import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { AnnouncementCard } from '@/components/home/AnnouncementCard'
import { GuruTaskTab } from '@/components/home/GuruTaskTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PublicPost } from '@/types'

async function getPosts() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('public_posts')
      .select('*, creator:users!public_posts_created_by_fkey(id, display_name, role)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    return (data ?? []) as PublicPost[]
  } catch {
    return []
  }
}

export default async function HomePage() {
  const posts = await getPosts()

  const pengumuman = posts.filter(p => p.type === 'pengumuman')
  const tugasSD = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'sd' || p.target === 'all'))
  const tugasSMP = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'smp' || p.target === 'all'))

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Rumah Qur&apos;an LHI</h1>
          <p className="text-muted-foreground mt-1">Informasi dan pengumuman untuk Guru Qur&apos;an</p>
        </div>

        {pengumuman.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3">Pengumuman</h2>
            <div className="space-y-3">
              {pengumuman.map(post => (
                <AnnouncementCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-base font-semibold mb-3">Tugas Guru</h2>
          <Tabs defaultValue="sd">
            <TabsList className="w-full">
              <TabsTrigger value="sd" className="flex-1">Guru Qur&apos;an SD</TabsTrigger>
              <TabsTrigger value="smp" className="flex-1">Guru Qur&apos;an SMP</TabsTrigger>
            </TabsList>
            <TabsContent value="sd" className="mt-4">
              <GuruTaskTab posts={tugasSD} emptyMessage="Belum ada tugas untuk Guru SD." />
            </TabsContent>
            <TabsContent value="smp" className="mt-4">
              <GuruTaskTab posts={tugasSMP} emptyMessage="Belum ada tugas untuk Guru SMP." />
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
