import { Newsreader } from 'next/font/google'
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
import { EkstraStrip, type KartuEkstra } from '@/components/home/EkstraStrip'
import { getDataEkstra, rupiah, type DataEkstra } from '@/lib/data/ekstra'
import { PublicFooter } from '@/components/home/PublicFooter'
import type { PublicPost, NewsArticle, KaldiEvent } from '@/types'
import { getKaldikEvents } from '@/lib/data/kaldik'

// Huruf judul Teduh; nama variabel lama dipertahankan agar pemakainya tak perlu diubah.
const playfair = Newsreader({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', style: ['normal', 'italic'] })

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

/**
 * Agenda kaldik untuk kalender beranda — tahun ini dan tahun depan, sebab
 * tahun ajaran membentang dua tahun kalender. Pengambilannya dipindah ke
 * lib/data/kaldik.ts supaya Kalender Qur'an milik koordinator membaca agenda
 * yang sama; dua kalender di satu aplikasi tidak boleh berbeda hari libur.
 */
async function getKaldiEvents(): Promise<KaldiEvent[]> {
  const year = new Date().getFullYear()
  return getKaldikEvents([year, year + 1])
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
  const ekstraCfg  = findSection(settings, 'ekstra')

  const [posts, newsItems, session, kaldiEvents, publicTeachers, programItems, stats, ekstra] = await Promise.all([
    getPosts(),
    news.enabled ? getNews(news.limit) : Promise.resolve([]),
    getSession(),
    agendaCfg.enabled ? getKaldiEvents() : Promise.resolve([]),
    guruCfg.enabled ? getPublicTeachers(guruCfg.limit) : Promise.resolve([]),
    programCfg.enabled ? getActivePrograms(programCfg.limit) : Promise.resolve([]),
    getHomeStats(),
    // Satu pengambilan untuk dua pemakai: kartu seksi Ekstra dan penanda
    // "Menerima ekstra" di kartu guru. Gagal = beranda tetap tampil tanpa ekstra.
    ekstraCfg.enabled || guruCfg.enabled
      ? getDataEkstra({ hanyaAktif: true }).catch(() => null)
      : Promise.resolve(null),
  ])

  const kartuEkstra = ekstraCfg.enabled && ekstra ? susunKartuEkstra(ekstra, ekstraCfg.limit) : []
  const guruEkstra = new Set((ekstra?.slot ?? []).map(s => s.teacher_id))

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
            // minmax(0,1fr), bukan 1fr/auto: kolom grid otomatis melebar mengikuti
            // isi terpanjangnya, dan di HP itu membuat seluruh beranda lebih lebar
            // dari layar (360px jadi 444px) sehingga halaman bisa digeser ke samping.
            className={`max-w-6xl mx-auto px-4 sm:px-6 pb-10 grid grid-cols-[minmax(0,1fr)] gap-5 items-start ${
              both ? 'md:grid-cols-[minmax(0,1fr)_400px]' : ''
            }`}
          >
            {pengCfg.enabled && (
              <div className="min-w-0 bg-card border rounded-[22px] p-4 sm:p-6">
                <AnnouncementBoard
                  posts={announcements}
                  title={pengCfg.title}
                  // Beranda menampilkan paling banyak 5 pengumuman; sisanya lewat "Lihat semua".
                  limit={Math.min(pengCfg.limit || 5, 5)}
                />
              </div>
            )}
            {agendaCfg.enabled && (
              <div className="min-w-0 flex flex-col gap-4">
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
          <TeacherStrip key="profil_guru" title={guruCfg.title} teachers={publicTeachers} menerimaEkstra={guruEkstra} />,
        )
        break

      case 'ekstra':
        blocks.push(<EkstraStrip key="ekstra" title={ekstraCfg.title} items={kartuEkstra} />)
        break
    }
  }

  return (
    <div
      className={`${playfair.variable} min-h-screen bg-background`}
      style={{ fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-7 md:pt-14 md:pb-9 flex justify-between items-end flex-wrap gap-6">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-warning mb-3 uppercase">
            {dateLabel}
          </p>
          <h1
            className="m-0 mb-3 font-normal leading-[1.05] tracking-[-0.02em]"
            style={{ ...headingFont, fontSize: 'clamp(34px, 6vw, 60px)' }}
          >
            Assalamu&apos;alaikum,{' '}
            <span className="border-b-[3px] border-accent-warm pb-0.5 italic text-primary">Ustadz/ah</span>
          </h1>
          <p className="text-[15px] md:text-[17px] text-muted-foreground m-0 max-w-xl leading-relaxed">
            Semoga hari ini penuh keberkahan dan kemudahan dalam mengajarkan Al-Qur&apos;an.
          </p>
        </div>

        <div className="flex gap-2.5 shrink-0">
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

/**
 * Kartu jenis ekstra untuk beranda: hanya jenis aktif yang punya slot dibuka,
 * 2–4 kartu. Hanya data yang memang publik — tidak ada data peserta, cuma
 * sisa kursi yang dijumlah dari semua jadwalnya.
 */
function susunKartuEkstra(data: DataEkstra, limit: number): KartuEkstra[] {
  const batas = Math.min(Math.max(limit || 4, 2), 4)
  return data.jenis
    .map(j => {
      const slot = data.slot.filter(s => s.jenis_id === j.id)
      return {
        id: j.id,
        nama: j.nama,
        bidang: j.bidang,
        biaya: `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}`,
        waktu: [j.durasi_menit ? `${j.durasi_menit} menit` : '', j.keterangan_waktu].filter(Boolean).join(' · '),
        sisa: slot.reduce((n, s) => n + Math.max(0, s.kuotaEfektif - s.peserta), 0),
        jadwal: slot.length,
      }
    })
    .filter(k => k.jadwal > 0)
    .slice(0, batas)
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
    <div className="bg-card border rounded-2xl px-5 py-4 text-center min-w-[92px] md:min-w-[112px] md:py-5">
      <div className="text-[32px] md:text-[38px] font-normal leading-none text-primary tabular-nums" style={font}>
        {value}
      </div>
      <div className="text-xs font-semibold text-muted-foreground mt-1.5">{label}</div>
    </div>
  )
}
