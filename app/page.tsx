import Link from 'next/link'
import { ArrowRight, BookOpen, Star, User, CheckCircle2, Sparkles } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { AnnouncementCard } from '@/components/home/AnnouncementCard'
import { UnitTabs } from '@/components/home/UnitTabs'
import { WeeklyAgenda } from '@/components/home/WeeklyAgenda'
import { ArabesqueBG, GeoStar, HeroIllustration, AbstractTile } from '@/components/home/Decorations'
import { Button } from '@/components/ui/button'
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

// TODO: ganti angka statistik ini sesuai data resmi RQ LHI
const HERO_STATS: [string, string][] = [
  ['420+', 'santri aktif'],
  ['29',   "guru Qur'an"],
  ['14 thn', 'berdiri'],
]

// TODO: ganti program inti & deskripsi sesuai kebutuhan
const PROGRAMS = [
  { icon: BookOpen,   title: 'Tahsin',       desc: 'Metode Tilawati: Jilid 1–6 hingga mushaf.',         variant: 0 },
  { icon: Star,       title: 'Tahfizh',      desc: 'Target 5–10 juz per jenjang lulus.',                variant: 1 },
  { icon: User,       title: 'Daurah Guru',  desc: 'Pembinaan intensif metode & ruh tarbiyah.',         variant: 3 },
]

export default async function HomePage() {
  const posts = await getPosts()

  const pengumuman = posts.filter((p) => p.type === 'pengumuman').slice(0, 4)
  const tugasSD = posts.filter((p) => p.type === 'tugas_guru' && (p.target === 'sd' || p.target === 'all'))
  const tugasSMP = posts.filter((p) => p.type === 'tugas_guru' && (p.target === 'smp' || p.target === 'all'))

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24">
        <div className="absolute inset-0 text-primary">
          <ArabesqueBG opacity={0.06} />
        </div>
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-2">
                <span className="h-px w-6 bg-current opacity-60" /> Beranda · Selamat datang
              </p>
              <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight">
                Mendampingi{' '}
                <span className="italic text-primary">guru Qur&apos;an</span>{' '}
                membangun generasi Qurani.
              </h1>
              <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Portal informasi & tugas untuk para Ustadz/Ustadzah di SDIT &amp; SMPIT LHI Banguntapan — agenda halaqoh, pengumuman yayasan, dan progres siswa, semua di satu tempat.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link href="/login">
                    Masuk ke Dashboard <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="rounded-full">
                  <Link href="#program">Tentang RQ LHI</Link>
                </Button>
              </div>

              <div className="mt-10 pt-6 border-t grid grid-cols-3">
                {HERO_STATS.map(([n, l], i) => (
                  <div
                    key={l}
                    className={`${i > 0 ? 'pl-6 border-l' : ''} ${i < HERO_STATS.length - 1 ? 'pr-2' : ''}`}
                  >
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight leading-none">
                      {n}
                    </div>
                    <div className="mt-2 text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* hero illustration with floating chips */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <HeroIllustration size={380} />

                <div className="absolute top-6 -right-4 sm:-right-8 bg-card border rounded-xl py-3 px-4 shadow-lg flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary-wash text-primary flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hari ini</p>
                    <p className="text-sm font-semibold leading-tight">18 setoran lulus</p>
                  </div>
                </div>

                <div className="absolute bottom-10 -left-4 sm:-left-10 bg-card border rounded-xl py-3 px-4 shadow-lg flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-accent-warm-wash text-accent-warm flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pekan ini</p>
                    <p className="text-sm font-semibold leading-tight">3 khataman juz</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TUGAS GURU ============ */}
      <section className="pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-[1.5fr_1fr] gap-8 items-end mb-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-2">
                <span className="h-px w-6 bg-current opacity-60" /> Tugas guru
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
                Apa yang perlu dikerjakan hari ini.
              </h2>
              <p className="mt-2.5 text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
                Tugas dan agenda dari koordinator unit. Klik salah satu untuk membuka detail lengkap, lampiran, dan diskusi.
              </p>
            </div>
          </div>

          <UnitTabs tugasSD={tugasSD} tugasSMP={tugasSMP} />
        </div>
      </section>

      {/* ============ PENGUMUMAN + AGENDA ============ */}
      <section className="py-20 bg-muted/40 border-y">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-warm inline-flex items-center gap-2">
                <span className="h-px w-6 bg-current opacity-60" /> Pengumuman
              </p>
              <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Kabar terbaru dari yayasan.
                </h2>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                >
                  Semua pengumuman <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {pengumuman.length === 0 ? (
                <div className="rounded-xl border border-dashed py-16 text-center bg-background">
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pengumuman.map((post) => (
                    <AnnouncementCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>

            <WeeklyAgenda posts={posts} />
          </div>
        </div>
      </section>

      {/* ============ PROGRAM ============ */}
      <section id="program" className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8 items-end mb-9">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary inline-flex items-center gap-2">
                <span className="h-px w-6 bg-current opacity-60" /> Program kami
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
                Enam program inti, satu tujuan:{' '}
                <span className="italic text-primary">generasi Qurani</span>.
              </h2>
            </div>
            <div className="flex md:justify-end">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="#">
                  Selengkapnya <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROGRAMS.map((p) => {
              const Icon = p.icon
              return (
                <article
                  key={p.title}
                  className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition group"
                >
                  <AbstractTile height={140} variant={p.variant} />
                  <div className="p-5">
                    <div className="h-10 w-10 rounded-lg bg-primary-wash text-primary inline-flex items-center justify-center mb-3.5">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-lg">{p.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ CTA / VISI ============ */}
      <section className="pb-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground">
            <div className="absolute inset-0 text-primary-foreground">
              <ArabesqueBG opacity={0.08} />
            </div>
            <div className="relative grid md:grid-cols-[1.4fr_1fr] gap-10 items-center p-8 md:p-14">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] inline-flex items-center gap-2 text-accent-warm">
                  <span className="h-px w-6 bg-current opacity-60" /> Visi kami
                </p>
                {/* TODO: ganti teks visi sesuai dokumen resmi RQ LHI */}
                <h2 className="mt-4 text-2xl md:text-3xl lg:text-4xl font-medium leading-snug tracking-tight">
                  <span className="text-accent-warm-wash">&ldquo;</span>
                  Menjadi rumah pembelajaran Al-Qur&apos;an yang melahirkan generasi cinta sunnah, berakhlak Qurani, dan bermanfaat bagi umat.
                  <span className="text-accent-warm-wash">&rdquo;</span>
                </h2>
                <Button
                  asChild
                  variant="ghost"
                  className="mt-6 rounded-full text-primary-foreground hover:bg-primary-foreground/10 border border-primary-foreground/30"
                >
                  <Link href="#program">
                    Tentang RQ LHI <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>

              <div className="flex justify-center">
                <div className="text-accent-warm-wash opacity-90">
                  <GeoStar size={220} strokeOnly />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl py-8 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
              RQ
            </div>
            Rumah Qur&apos;an LHI · Banguntapan, Bantul
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} RQ LHI. Portal Guru Qur&apos;an.
          </p>
        </div>
      </footer>
    </div>
  )
}
