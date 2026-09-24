import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import type { PublicPost } from '@/types'

/**
 * Pengumuman dibaca DI DALAM portal guru.
 *
 * Alamat publiknya (/pengumuman/[id]) tetap ada dan tetap bisa dibagikan ke
 * siapa pun. Yang berubah: tautan dari dashboard guru dan dari lonceng kini
 * menuju ke sini.
 *
 * KENAPA PERLU HALAMAN SENDIRI
 *
 * Halaman publik memakai PublicHeader dan PublicFooter — menu Beranda, Berita,
 * Program. Guru yang mengetuk pengumuman di dashboardnya jadi terlempar keluar
 * dari portalnya: navigasi kirinya hilang, dan satu-satunya jalan kembali
 * adalah tombol "kembali ke beranda" yang justru membawanya makin jauh.
 * Di sini ia tetap berada di kerangka yang sama, dan tombol kembalinya menuju
 * dashboard guru.
 *
 * Isinya sengaja dibuat mirip halaman publik — kertas bergaris yang sama
 * dilepas, tapi tipografi dan susunannya dipertahankan — supaya pengumuman
 * yang sama terbaca sebagai benda yang sama di kedua tempat.
 */

async function getPost(id: string): Promise<PublicPost | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('public_posts')
      .select('*, creator:users!created_by(id, display_name, role)')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    return (data as PublicPost) ?? null
  } catch {
    return null
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function PengumumanGuruPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()

  const isTugas = post.type === 'tugas_guru'
  const unit = post.target === 'sd' ? 'SDIT LHI' : post.target === 'smp' ? 'SMPIT LHI' : 'Umum'
  const overdue = post.due_date ? new Date(post.due_date) < new Date() : false

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/guru"
        className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />Kembali ke dashboard
      </Link>

      <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-accent-warm">
              {isTugas ? 'Tugas Guru' : 'Pengumuman'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {unit}
            </span>
            {overdue && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                Lewat tenggat
              </span>
            )}
          </div>

          <h1
            className="text-3xl leading-[1.2] tracking-tight sm:text-[28px]"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            {post.title}
          </h1>

          <p className="mt-2 text-xs text-muted-foreground">
            {post.creator ? `oleh ${post.creator.display_name} · ` : ''}
            {formatDate(post.created_at)}
          </p>

          {post.due_date && (
            <p
              className={cn(
                'mt-3 inline-flex items-center gap-1.5 text-sm',
                overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              <Calendar className="h-4 w-4" />
              Tenggat: {formatDate(post.due_date)}
            </p>
          )}

          <div className="my-5 h-px bg-border" />

          {/* Flyer utuh — sama dengan halaman publik; ketuk untuk ukuran aslinya. */}
          {post.image_url && (
            <a href={post.image_url} target="_blank" rel="noopener noreferrer" className="mb-6 block" title="Buka gambar ukuran penuh">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt={`Flyer: ${post.title}`}
                className="mx-auto max-h-[80vh] w-auto max-w-full rounded-md border object-contain shadow-sm"
              />
            </a>
          )}

          <Markdown content={post.content} className="text-[15px] leading-[28px]" />
        </div>
      </article>
    </div>
  )
}
