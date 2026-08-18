import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews, canEditProgram } from '@/lib/auth/permissions'
import { getSiteSettings, getPublicTeachers, findSection } from '@/lib/data/site'
import { getActivePrograms } from '@/lib/data/programs'
import { getHomeStats } from '@/lib/data/home-stats'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { MonthAgenda } from '@/components/home/MonthAgenda'
import { AnnouncementBoard } from '@/components/home/AnnouncementBoard'
import { NewsCarousel } from '@/components/home/NewsCarousel'
import { ProgramCarousel } from '@/components/home/ProgramCarousel'
import { TeacherStrip } from '@/components/home/TeacherStrip'
import { PublicFooter } from '@/components/home/PublicFooter'
import type { PublicPost, NewsArticle, KaldiEvent } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

/**
 * "Hari ini" menurut WIB, bukan menurut jam server.
 *
 * Vercel menjalankan fungsi di UTC, jadi `new Date()` di server sudah berganti
 * hari 7 jam lebih lambat daripada pengguna di Indonesia — antara 00:00 dan
 * 07:00 WIB kalender akan menandai tanggal kemarin sebagai "Hari ini".
 * Tanggalnya diambil lewat Intl agar tidak perlu menghitung offset sendiri
 * (dan tetap benar seandainya aturan zona berubah).
 */
function todayInJakarta(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [y, m, d] = parts.split('-').map(Number)
  // Tengah hari UTC: cukup jauh dari kedua tepi tanggal sehingga pergeseran
  // zona pembaca tidak pernah menggesernya ke hari sebelum/sesudahnya.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

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

const KALDI_BASE = 'https://kaldikrqlhi.vercel.app'

/** Identitas logis satu agenda — dipakai untuk membuang duplikat. */
function kaldiKey(e: KaldiEvent) {
  return `${e.date ?? e.start ?? ''}|${e.title}|${e.unit ?? ''}`
}

async function getKaldiYear(year: number): Promise<KaldiEvent[]> {
  try {
    const res = await fetch(`${KALDI_BASE}/api/calendar?year=${year}`, {
      next: { revalidate: 300 }, // 5 menit
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.events ?? []) as KaldiEvent[]
  } catch {
    return []
  }
}

/**
 * Agenda kaldik untuk kalender beranda.
 *
 * Memakai `/api/calendar?year=`, bukan `/api/upcoming`. `upcoming` adalah feed
 * "N agenda terdekat": `days` cuma menyaring batas atas, sedangkan jumlah baris
 * dipatok `limit` (default 50, server menolak di atas 100). Akibatnya
 * `?days=90` nyatanya hanya sampai ~3 pekan ke depan, dan bulan yang sudah
 * lewat tidak pernah terisi karena feed itu selalu mulai dari hari ini.
 * `calendar` mengembalikan setahun penuh tanpa batas.
 *
 * Tahun berikutnya ikut diambil karena tahun ajaran membentang dua tahun
 * kalender — tanpa itu, Januari kosong setiap kali Desember terlewati. Tahun
 * yang belum diisi membalas `events: []`, jadi aman.
 *
 * Data sumber mengandung duplikat (agenda yang sama ter-seed dua kali, ~36%
 * dari payload). Dibuang di sini supaya tidak tampil ganda di daftar harian
 * dan tidak ikut terkirim ke klien.
 */
async function getKaldiEvents(): Promise<KaldiEvent[]> {
  const year = new Date().getFullYear()
  const years = await Promise.all([getKaldiYear(year), getKaldiYear(year + 1)])

  const seen = new Set<string>()
  const unique: KaldiEvent[] = []
  for (const e of years.flat()) {
    const key = kaldiKey(e)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(e)
  }
  return unique
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
  const agendaCfg  = findSection(settings, 'agenda')
  const pengCfg    = findSection(settings, 'pengumuman')
  const programCfg = findSection(settings, 'program')
  const guruCfg    = findSection(settings, 'profil_guru')

  const [posts, newsItems, session, kaldiEvents, publicTeachers, programItems, stats] = await Promise.all([
    getPosts(),
    news.enabled ? getNews(news.limit) : Promise.resolve([]),
    getSession(),
    agendaCfg.enabled ? getKaldiEvents() : Promise.resolve([]),
    guruCfg.enabled ? getPublicTeachers(guruCfg.limit) : Promise.resolve([]),
    programCfg.enabled ? getActivePrograms(programCfg.limit) : Promise.resolve([]),
    getHomeStats(),
  ])

  const now = todayInJakarta()

  // Pengumuman & tugas guru tampil dalam satu papan — pembacanya sama, dan
  // memisahkannya cuma membuat satu informasi terlewat karena ada di kolom lain.
  const announcements = posts.filter(p => p.type === 'pengumuman' || p.type === 'tugas_guru')
  const userCanCreateNews = session ? canCreateNews(session.role) : false
  const userCanEditProgram = session ? canEditProgram(session.role) : false

  const todayIso = now.toISOString()

  // Getter UTC, sepasang dengan `todayInJakarta` yang menyimpan tanggal WIB
  // sebagai tengah hari UTC — getter lokal akan mengembalikannya ke jam server.
  const dateLabel = `${DAY_ID[now.getUTCDay()]}, ${now.getUTCDate()} ${MONTH_ID[now.getUTCMonth()]} ${now.getUTCFullYear()}`
  const headingFont = { fontFamily: "var(--font-playfair), 'Georgia', serif" }

  /**
   * Seksi dirender mengikuti urutan `settings.sections`.
   *
   * Pengumuman & Agenda berbagi satu baris dua kolom. Blok gabungan itu
   * ditempatkan pada posisi seksi yang lebih dulu muncul di urutan, lalu
   * keduanya ditandai sudah dirender supaya tidak muncul dua kali. Kalau hanya
   * salah satu yang aktif, ia tampil selebar penuh.
   */
  const blocks: React.ReactNode[] = []
  let gridRendered = false

  for (const section of settings.sections) {
    if (!section.enabled) continue

    switch (section.key) {
      case 'pengumuman':
      case 'agenda': {
        if (gridRendered) break
        gridRendered = true
        const both = pengCfg.enabled && agendaCfg.enabled
        blocks.push(
          <section
            key="grid"
            id="pengumuman"
            className={`max-w-5xl mx-auto px-6 pb-6 grid gap-4 items-start ${
              both ? 'md:grid-cols-[1fr_370px]' : 'grid-cols-1'
            }`}
          >
            {pengCfg.enabled && (
              <div className="bg-card border rounded-2xl p-5">
                <AnnouncementBoard
                  posts={announcements}
                  title={pengCfg.title}
                  limit={pengCfg.limit || 6}
                />
              </div>
            )}
            {agendaCfg.enabled && (
              <div className="flex flex-col gap-4">
                <MonthAgenda
                  posts={posts}
                  kaldiEvents={kaldiEvents}
                  todayIso={todayIso}
                  title={agendaCfg.title}
                />
              </div>
            )}
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
          <ProgramCarousel
            key="program"
            items={programItems}
            title={programCfg.title}
            canManage={userCanEditProgram}
          />,
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
          <p className="text-sm text-muted-foreground m-0 max-w-md leading-relaxed">
            Semoga hari ini penuh keberkahan dan kemudahan dalam mengajarkan Al-Qur&apos;an.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <HeroStat value={stats.units} label="unit" font={headingFont} />
          <HeroStat value={stats.pengampu} label="pengampu" font={headingFont} />
          <HeroStat value={stats.siswa} label="siswa" font={headingFont} />
        </div>
      </section>

      {blocks}

      {/* ─── TENTANG (anchor) + FOOTER ──────────────────────────── */}
      <span id="tentang" />
      <PublicFooter />
    </div>
  )
}

function HeroStat({
  value,
  label,
  font,
}: {
  value: number
  label: string
  font: React.CSSProperties
}) {
  return (
    <div className="bg-card border rounded-xl px-5 py-4 text-center min-w-[88px]">
      <div className="text-[30px] font-bold leading-none text-foreground tabular-nums" style={font}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[0.2px]">{label}</div>
    </div>
  )
}
