import { ImageResponse } from 'next/og'
import { createServerClient } from '@/lib/supabase/server'
import type { NewsCategory } from '@/types'

export const alt = 'Berita Rumah Qur\'an LHI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  sdit_lhi:     { label: 'SDIT LHI',     color: '#10B981' },
  smpit_lhi:    { label: 'SMPIT LHI',    color: '#3B82F6' },
  sma_lhi:      { label: 'SMA LHI',      color: '#8B5CF6' },
  paud_lhi:     { label: 'PAUD LHI',     color: '#EC4899' },
  sd_lhi_juara: { label: 'SD LHI Juara', color: '#F59E0B' },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function Image({ params }: Props) {
  const { id } = await params

  let title = 'Berita Rumah Qur\'an LHI'
  let category: NewsCategory | null = null
  let type = 'berita'
  let author: string | null = null
  let thumbnailDataUrl: string | null = null

  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('news_articles')
      .select('title, category, type, thumbnail_url, author:users!news_articles_author_id_fkey(display_name)')
      .eq('id', id)
      .maybeSingle()

    if (data) {
      title = data.title ?? title
      category = (data.category as NewsCategory) ?? null
      type = data.type ?? 'berita'
      author = (data.author as unknown as { display_name: string } | null)?.display_name ?? null

      // Embed thumbnail sebagai data URI (aman; gagal → gradient)
      if (data.thumbnail_url) {
        try {
          const res = await fetch(data.thumbnail_url)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            const ct = res.headers.get('content-type') ?? 'image/jpeg'
            thumbnailDataUrl = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
          }
        } catch {
          thumbnailDataUrl = null
        }
      }
    }
  } catch {
    // pakai default
  }

  const cat = category ? CATEGORY_META[category] : null
  const accent = cat?.color ?? '#b8860b'
  const badge = type === 'artikel' ? 'ARTIKEL' : (cat?.label ?? 'BERITA').toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative',
          background: thumbnailDataUrl ? '#111' : `linear-gradient(135deg, ${accent} 0%, #1a1a1a 100%)`,
          fontFamily: 'serif',
        }}
      >
        {/* Foto background + overlay gelap */}
        {thumbnailDataUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailDataUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.4) 100%)' }} />
          </>
        )}

        {/* Top bar: brand */}
        <div style={{ position: 'absolute', top: 48, left: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#b8860b', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800,
          }}>RQ</div>
          <div style={{ color: 'white', fontSize: 20, letterSpacing: 2, opacity: 0.95 }}>RUMAH QUR&apos;AN LHI</div>
        </div>

        {/* Konten bawah */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: 56, gap: 18, zIndex: 1 }}>
          <div style={{ display: 'flex' }}>
            <div style={{
              background: accent, color: 'white', fontSize: 20, fontWeight: 700,
              padding: '6px 16px', borderRadius: 8, letterSpacing: 1,
            }}>{badge}</div>
          </div>
          <div style={{ color: 'white', fontSize: 56, fontWeight: 800, lineHeight: 1.1, maxWidth: 1050 }}>
            {title.length > 110 ? title.slice(0, 110) + '…' : title}
          </div>
          {author && (
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 24 }}>Oleh {author}</div>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
