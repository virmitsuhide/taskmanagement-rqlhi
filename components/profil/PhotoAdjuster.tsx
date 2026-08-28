'use client'

import { useRef, useState } from 'react'
import { RotateCcw, UserRound } from 'lucide-react'
import { DEFAULT_FOCUS, ZOOM_MAX, ZOOM_MIN, isDefaultFocus, photoStyle } from '@/lib/profil/foto'
import type { PhotoFocus } from '@/types'

interface Props {
  /** Awalan nama field tersembunyi: `${name}_x`, `${name}_y`, `${name}_zoom`. */
  name: string
  src: string | null
  initial?: PhotoFocus
  /** Diameter lingkaran dalam piksel. */
  size?: number
  /** Sembunyikan slider & keterangan — dipakai di baris daftar yang padat. */
  compact?: boolean
  label?: string
}

/**
 * Lingkaran foto yang bisa digeser isinya. Nilai akhirnya dikirim lewat input
 * tersembunyi, jadi komponen ini menyatu dengan <form action={…}> biasa tanpa
 * perlu state di pemanggilnya.
 *
 * Yang digeser adalah CSS object-position, bukan berkasnya — foto asli tetap
 * utuh di storage dan potongannya dihitung ulang di tiap ukuran lingkaran.
 * Lihat drizzle/0040 untuk alasan lengkapnya.
 */
export function PhotoAdjuster({
  name, src, initial, size = 96, compact = false, label,
}: Props) {
  const [focus, setFocus] = useState<PhotoFocus>(initial ?? DEFAULT_FOCUS)
  const dragging = useRef<{ px: number; py: number } | null>(null)

  // Menggeser kursor ke kanan harus memunculkan bagian kiri foto, dan
  // object-position bekerja terbalik dari itu — karena itu dx dikurangkan.
  // Pembaginya ukuran lingkaran supaya rasa geseran sama di ukuran mana pun.
  function move(dx: number, dy: number) {
    setFocus(f => ({
      ...f,
      x: Math.min(100, Math.max(0, f.x - (dx / size) * 100)),
      y: Math.min(100, Math.max(0, f.y - (dy / size) * 100)),
    }))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!src) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { px: e.clientX, py: e.clientY }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragging.current
    if (!d) return
    move(e.clientX - d.px, e.clientY - d.py)
    dragging.current = { px: e.clientX, py: e.clientY }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // Panah keyboard: satu-satunya cara mengatur posisi tanpa tetikus.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!src) return
    const step = e.shiftKey ? 10 : 3
    const map: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step],
    }
    const delta = map[e.key]
    if (!delta) return
    e.preventDefault()
    // move() memakai piksel; di sini langkahnya sudah dalam persen.
    setFocus(f => ({
      ...f,
      x: Math.min(100, Math.max(0, f.x - delta[0])),
      y: Math.min(100, Math.max(0, f.y - delta[1])),
    }))
  }

  return (
    <div className={compact ? 'flex items-center gap-2' : 'space-y-2'}>
      <input type="hidden" name={`${name}_x`} value={Math.round(focus.x)} />
      <input type="hidden" name={`${name}_y`} value={Math.round(focus.y)} />
      <input type="hidden" name={`${name}_zoom`} value={Math.round(focus.zoom)} />

      <div
        role={src ? 'application' : undefined}
        tabIndex={src ? 0 : undefined}
        aria-label={src ? (label ?? 'Geser foto agar pas di lingkaran') : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ width: size, height: size }}
        className={`relative rounded-full overflow-hidden border bg-muted shrink-0 touch-none
          flex items-center justify-center
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${src ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-full w-full select-none"
            style={photoStyle(focus)}
          />
        ) : (
          <UserRound className="h-1/3 w-1/3 text-muted-foreground" />
        )}
      </div>

      {src && !compact && (
        <div className="space-y-1.5" style={{ maxWidth: 220 }}>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">Perbesar</span>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              value={focus.zoom}
              onChange={e => setFocus(f => ({ ...f, zoom: Number(e.target.value) }))}
              className="w-full accent-primary"
              aria-label="Perbesaran foto"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Seret fotonya untuk menggeser.</p>
            {!isDefaultFocus(focus) && (
              <button
                type="button"
                onClick={() => setFocus(DEFAULT_FOCUS)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw className="h-3 w-3" />Atur ulang
              </button>
            )}
          </div>
        </div>
      )}

      {src && compact && (
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          value={focus.zoom}
          onChange={e => setFocus(f => ({ ...f, zoom: Number(e.target.value) }))}
          className="w-16 accent-primary"
          aria-label={label ? `Perbesaran ${label}` : 'Perbesaran foto'}
        />
      )}
    </div>
  )
}
