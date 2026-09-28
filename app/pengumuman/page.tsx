import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Newsreader } from 'next/font/google'
import type { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { AnnouncementCard } from '@/components/home/AnnouncementCard'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import type { PublicPost } from '@/types'

const PAGE_SIZE = 10

// Huruf judul Teduh; nama variabel lama dipertahankan agar pemakainya tak perlu diubah.
const playfair = Newsreader({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', style: ['normal', 'italic'] })

export const metadata: Metadata = {
  title: 'Semua Pengumuman — RQ LHI',
  description: 'Pengumuman dan tugas guru Rumah Qur\'an LHI, dari yang terbaru.',
}

type Unit = 'sd' | 'smp'

const UNIT_TABS: { nilai: Unit | undefined; label: string }[] = [
  { nilai: undefined, label: 'Semua' },
  { nilai: 'sd', label: 'SDIT LHI' },
  { nilai: 'smp', label: 'SMPIT LHI' },
]

/**
 * Satu halaman pengumuman, terbaru dulu menurut waktu diterbitkan.
 *
 * Dipotong di basis data (range + count), bukan diambil semua lalu diiris:
 * pengumuman terus bertambah tiap pekan, dan halaman ini hanya butuh sepuluh.
 */
async function getHalaman(page: number, unit: Unit | undefined) {
  try {
    const supabase = createServerClient()
    let q = supabase
      .from('public_posts')
      .select('*, creator:users!created_by(id, display_name, role)', { count: 'exact' })
      .eq('is_active', true)
      .in('type', ['pengumuman', 'tugas_guru'])
    // Post bertarget 'all' berlaku untuk semua unit, jadi selalu ikut.
    if (unit) q = q.in('target', [unit, 'all'])
    const dari = (page - 1) * PAGE_SIZE
    const { data, count } = await q
      .order('created_at', { ascending: false })
      .range(dari, dari + PAGE_SIZE - 1)
    return { posts: (data ?? []) as PublicPost[], total: count ?? 0 }
  } catch {
    return { posts: [] as PublicPost[], total: 0 }
  }
}

interface PageProps {
  searchParams: Promise<{ page?: string; unit?: string }>
}

export default async function SemuaPengumumanPage({ searchParams }: PageProps) {
  const params = await searchParams
  const unit = params.unit === 'sd' || params.unit === 'smp' ? params.unit : undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const { posts, total } = await getHalaman(page, unit)

  // Nomor halaman melewati ujung (tautan lama, atau pengumuman dihapus):
  // arahkan ke halaman terakhir yang ada, bukan layar kosong.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > totalPages) {
    const qs = new URLSearchParams()
    if (unit) qs.set('unit', unit)
    if (totalPages > 1) qs.set('page', String(totalPages))
    redirect(qs.size ? `/pengumuman?${qs}` : '/pengumuman')
  }

  return (
    <div className={`${playfair.variable} min-h-screen bg-background`} style={{ fontSize: 14, lineHeight: 1.5 }}>
      <PublicHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/#pengumuman"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke beranda
        </Link>

        <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1
              className="m-0 text-3xl font-normal leading-tight tracking-[-0.01em] md:text-[34px]"
              style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
            >
              Semua Pengumuman
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total > 0 ? `${total} pengumuman, terbaru di atas.` : 'Belum ada pengumuman.'}
            </p>
          </div>
          <nav aria-label="Saring unit" className="flex gap-0.5 bg-muted rounded-[10px] p-[3px]">
            {UNIT_TABS.map(t => {
              const aktif = t.nilai === unit
              return (
                <Link
                  key={t.label}
                  // Ganti unit selalu kembali ke halaman 1 — nomor halaman lama
                  // tidak bermakna pada daftar yang berbeda.
                  href={t.nilai ? `/pengumuman?unit=${t.nilai}` : '/pengumuman'}
                  aria-current={aktif ? 'page' : undefined}
                  className={cn(
                    'px-3.5 py-1.5 rounded-[7px] text-[13px] font-semibold transition-all',
                    aktif ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map(post => <AnnouncementCard key={post.id} post={post} />)}
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/pengumuman"
          searchParams={{ unit }}
          className="mt-4"
        />
      </main>

      <PublicFooter />
    </div>
  )
}
