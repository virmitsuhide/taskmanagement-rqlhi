import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { getSiteSettings, getPublicTeachers, findSection } from '@/lib/data/site'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { WeeklyAgenda } from '@/components/home/WeeklyAgenda'
import { TugasGuruList } from '@/components/home/TugasGuruList'
import { NewsCarousel } from '@/components/home/NewsCarousel'
import { NotePaperCard } from '@/components/home/NotePaperCard'
import { ProgramGrid } from '@/components/home/ProgramGrid'
import { TeacherStrip } from '@/components/home/TeacherStrip'
import { PublicFooter } from '@/components/home/PublicFooter'
import type { PublicPost, NewsArticle, KaldiEvent } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

async function getNews(limit: number): Promise<NewsArticle[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('news_articles')
      .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as NewsArticle[]
  } catch {
    return []
  }
}

async function getKaldiEvents(): Promise<KaldiEvent[]> {
  try {
    const res = await fetch('https://kaldikrqlhi.vercel.app/api/upcoming?days=14', {
      next: { revalidate: 300 }, // 5 menit
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.events ?? []) as KaldiEvent[]
  } catch {
    return []
  }
}

async function getPosts() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('public_posts')
      .select('*, creator:users!created_by(id, display_name, role)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    return (data ?? []) as PublicPost[]
  } catch {
    return []
  }
}

export default async function HomePage() {
  const settings = await getSiteSettings()

  const news       = findSection(settings, 'news')
  const tugasCfg   = findSection(settings, 'tugas')
  const agendaCfg  = findSection(settings, 'agenda')
  const pengCfg    = findSection(settings, 'pengumuman')
  const programCfg = findSection(settings, 'program')
  const guruCfg    = findSection(settings, 'profil_guru')

  const [posts, newsItems, session, kaldiEvents, publicTeachers] = await Promise.all([
    getPosts(),
    news.enabled ? getNews(news.limit) : Promise.resolve([]),
    getSession(),
    agendaCfg.enabled ? getKaldiEvents() : Promise.resolve([]),
    guruCfg.enabled ? getPublicTeachers(guruCfg.limit) : Promise.resolve([]),
  ])

  const now = new Date()

  const pengumuman  = posts.filter(p => p.type === 'pengumuman')
  const tugasSD     = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'sd'  || p.target === 'all'))
  const tugasSMP    = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'smp' || p.target === 'all'))
  const allTugas    = [...tugasSD, ...tugasSMP]
  const overdueCount = allTugas.filter(p => p.due_date && new Date(p.due_date) < now).length
  const userCanCreateNews = session ? canCreateNews(session.role) : false

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const monday = new Date(todayStart)
  monday.setDate(todayStart.getDate() - ((now.getDay() + 6) % 7))
  const weekStartIso = monday.toISOString()
  const todayIso = todayStart.toISOString()

  const dateLabel = `${DAY_ID[now.getDay()]}, ${now.getDate()} ${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`
  const headingFont = { fontFamily: "var(--font-playfair), 'Georgia', serif" }

  /**
   * Seksi dirender mengikuti urutan `settings.sections`.
   *
   * Tugas & Agenda adalah pengecualian: keduanya berbagi satu baris dua kolom.
   * Blok gabungan itu ditempatkan pada posisi seksi yang lebih dulu muncul di
   * urutan, lalu keduanya ditandai sudah dirender supaya tidak muncul dua kali.
   * Kalau hanya salah satu yang aktif, ia tampil selebar penuh.
   */
  const blocks: React.ReactNode[] = []
  let gridRendered = false

  for (const section of settings.sections) {
    if (!section.enabled) continue

    switch (section.key) {
      case 'tugas':
      case 'agenda': {
        if (gridRendered) break
        gridRendered = true
        const both = tugasCfg.enabled && agendaCfg.enabled
        blocks.push(
          <section
            key="grid"
            id="tugas"
            className={`max-w-5xl mx-auto px-6 pb-6 grid gap-4 items-start ${
              both ? 'md:grid-cols-[1fr_370px]' : 'grid-cols-1'
            }`}
          >
            {tugasCfg.enabled && (
              <div className="bg-card border rounded-2xl p-5">
                <TugasGuruList
                  tugasSD={tugasSD}
                  tugasSMP={tugasSMP}
                  title={tugasCfg.title}
                  limit={tugasCfg.limit || 6}
                />
              </div>
            )}
            {agendaCfg.enabled && (
              <div className="flex flex-col gap-4">
                <WeeklyAgenda
                  posts={posts}
                  kaldiEvents={kaldiEvents}
                  weekStartIso={weekStartIso}
                  todayIso={todayIso}
                  title={agendaCfg.title}
                />
              </div>
            )}
          </section>,
        )
        break
      }

      case 'pengumuman': {
        if (pengumuman.length === 0) break
        blocks.push(
          <section key="pengumuman" id="pengumuman" className="max-w-5xl mx-auto px-6 pb-8">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h2 className="m-0 text-base font-bold tracking-tight" style={headingFont}>
                {pengCfg.title}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                klik judul untuk baca selengkapnya
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {pengumuman.slice(0, pengCfg.limit || 6).map(post => (
                <NotePaperCard key={post.id} post={post} kicker="Pengumuman" />
              ))}
            </div>
          </section>,
        )
        break
      }

      case 'news':
        blocks.push(
          <NewsCarousel key="news" items={newsItems} canCreate={userCanCreateNews} title={news.title} />,
        )
        break

      case 'program':
        blocks.push(
          <ProgramGrid key="program" title={programCfg.title} limit={programCfg.limit || 4} />,
        )
        break

      case 'profil_guru':
        blocks.push(
          <TeacherStrip key="profil_guru" title={guruCfg.title} teachers={publicTeachers} />,
        )
        break
    }
  }

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-lora), 'Georgia', serif", fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-9 pb-6 flex justify-between items-end flex-wrap gap-5">
        <div>
          <p className="text-[11px] tracking-[1.8px] text-muted-foreground mb-2.5 uppercase">
            {dateLabel}
          </p>
          <h1
            className="m-0 mb-2.5 font-bold leading-[1.12] tracking-tight"
            style={{ ...headingFont, fontSize: 'clamp(26px, 5vw, 42px)' }}
          >
            Assalamu&apos;alaikum,{' '}
            <span className="border-b-[3px] border-accent-warm pb-1">Ustadz/ah</span>
          </h1>
          <p className="text-sm text-muted-foreground m-0">
            {allTugas.length > 0
              ? `${allTugas.length} tugas aktif`
              : 'Belum ada tugas aktif'}
            {overdueCount > 0 && ` · ${overdueCount} mendekati tenggat`}
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <div className="bg-card border rounded-xl px-6 py-4 text-center min-w-[94px]">
            <div className="text-[30px] font-bold leading-none text-foreground" style={headingFont}>
              {allTugas.length}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[0.2px]">tugas aktif</div>
          </div>
          {overdueCount > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-6 py-4 text-center min-w-[94px]">
              <div className="text-[30px] font-bold leading-none text-destructive" style={headingFont}>
                {overdueCount}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[0.2px]">terlambat</div>
            </div>
          )}
        </div>
      </section>

      {blocks}

      {/* ─── TENTANG (anchor) + FOOTER ──────────────────────────── */}
      <span id="tentang" />
      <PublicFooter />
    </div>
  )
}
