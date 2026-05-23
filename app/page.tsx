import Link from 'next/link'
import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { WeeklyAgenda } from '@/components/home/WeeklyAgenda'
import { TugasGuruList } from '@/components/home/TugasGuruList'
import { PublicFooter } from '@/components/home/PublicFooter'
import type { PublicPost } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTH_S  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// TODO: ganti dengan data CMS / konten resmi RQ LHI
const KABAR = [
  { tag: 'Wisuda',  colorBg: 'bg-primary-wash',                         colorText: 'text-primary',       imgFrom: 'from-green-100  dark:from-green-950',  imgTo: 'to-green-50  dark:to-green-900',  unit: 'SDIT LHI',  date: '15 Jul 2026', title: 'Wisuda Tahfizh Angkatan ke-8'     },
  { tag: 'Program', colorBg: 'bg-blue-50 dark:bg-blue-950/60',          colorText: 'text-blue-600 dark:text-blue-400', imgFrom: 'from-blue-100 dark:from-blue-950', imgTo: 'to-blue-50 dark:to-blue-900', unit: 'SMPIT LHI', date: '10 Jun 2026', title: 'Program Tahsin Wali Santri'        },
  { tag: 'Kabar',   colorBg: 'bg-accent-warm-wash',                     colorText: 'text-accent-warm',   imgFrom: 'from-amber-100 dark:from-amber-950',  imgTo: 'to-amber-50 dark:to-amber-900',   unit: 'RQ LHI',    date: '1 Jun 2026',  title: "Daurah Guru Qur'an Intensif"      },
  { tag: 'Tentang', colorBg: 'bg-purple-50 dark:bg-purple-950/60',      colorText: 'text-purple-600 dark:text-purple-400', imgFrom: 'from-purple-100 dark:from-purple-950', imgTo: 'to-purple-50 dark:to-purple-900', unit: 'RQ LHI', date: '1 Mei 2026',  title: 'Visi & Misi Rumah Qur\'an LHI'    },
]

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
  const posts  = await getPosts()
  const now    = new Date()

  const pengumuman  = posts.filter(p => p.type === 'pengumuman')
  const tugasSD     = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'sd'  || p.target === 'all'))
  const tugasSMP    = posts.filter(p => p.type === 'tugas_guru' && (p.target === 'smp' || p.target === 'all'))
  const allTugas    = [...tugasSD, ...tugasSMP]
  const overdueCount = allTugas.filter(p => p.due_date && new Date(p.due_date) < now).length
  const latestPeng  = pengumuman.slice(0, 3)

  const dateLabel = `${DAY_ID[now.getDay()]}, ${now.getDate()} ${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`

  const headingFont = { fontFamily: "var(--font-playfair), 'Georgia', serif" }

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
            {latestPeng.length > 0 && ` · ${latestPeng.length} pengumuman`}
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

      {/* ─── MAIN GRID ───────────────────────────────────────────── */}
      <section id="tugas" className="max-w-5xl mx-auto px-6 pb-6 grid md:grid-cols-[1fr_370px] gap-4 items-start">

        {/* Kiri: Tugas Guru */}
        <div className="bg-card border rounded-2xl p-5">
          <TugasGuruList tugasSD={tugasSD} tugasSMP={tugasSMP} />
        </div>

        {/* Kanan: Pengumuman + Agenda */}
        <div className="flex flex-col gap-4">

          {/* Pengumuman */}
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="m-0 text-base font-bold tracking-tight text-foreground" style={headingFont}>
                Pengumuman
              </h2>
              {latestPeng.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-warm-wash text-accent-warm tracking-wide">
                  {latestPeng.length} baru
                </span>
              )}
            </div>

            {latestPeng.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-7">Belum ada pengumuman.</p>
            ) : (
              <>
                {latestPeng.map(p => {
                  const d = new Date(p.created_at)
                  return (
                    <div key={p.id} className="flex justify-between items-center py-2.5 border-b border-dashed border-border last:border-0 gap-2">
                      <p className="text-[13px] font-medium flex-1 leading-snug">{p.title}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {d.getDate()} {MONTH_S[d.getMonth()]}
                      </span>
                      <span className="text-base text-muted-foreground/40 shrink-0 leading-none">›</span>
                    </div>
                  )
                })}
                <Link
                  href="/login"
                  className="block text-left text-xs text-muted-foreground mt-2.5 hover:text-foreground transition-colors"
                >
                  lihat semua pengumuman →
                </Link>
              </>
            )}
          </div>

          {/* Agenda */}
          <WeeklyAgenda posts={posts} />

          {/* CTA login */}
          <Link
            href="/login"
            className="block w-full text-center py-2.5 bg-accent-warm-wash text-accent-warm border border-accent-warm/25 rounded-xl text-[13px] font-bold hover:bg-accent-warm/10 transition-colors"
          >
            masuk ke dashboard →
          </Link>

        </div>
      </section>

      {/* ─── KABAR & PROGRAM ────────────────────────────────────── */}
      <section id="kabar" className="max-w-5xl mx-auto px-6 pb-9">
        <div className="flex items-center justify-between mb-4">
          <h2 className="m-0 text-lg font-bold tracking-tight text-foreground" style={headingFont}>
            Kabar &amp; Program
          </h2>
          <button className="text-xs text-muted-foreground px-2.5 py-1 border rounded-md bg-card hover:text-foreground transition-colors">
            Semua
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {KABAR.map((k, i) => (
            <div
              key={i}
              className="bg-card border rounded-xl overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group"
            >
              <div className={`h-28 bg-gradient-to-br ${k.imgFrom} ${k.imgTo} border-b`} />
              <div className="p-3 pb-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-[0.5px] ${k.colorBg} ${k.colorText}`}>
                    {k.tag}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{k.unit}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mb-1">{k.date}</div>
                <div className="text-[13px] font-semibold text-foreground leading-[1.3]">{k.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TENTANG (anchor) + FOOTER ──────────────────────────── */}
      <span id="tentang" />
      <PublicFooter />
    </div>
  )
}
