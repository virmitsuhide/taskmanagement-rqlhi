'use client'

import { useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import {
  DEFAULT_FOCUS, ZOOM_MAX, ZOOM_MIN, coverSize, isDefaultFocus, panDelta, photoStyle,
} from '@/lib/profil/foto'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { PhotoFocus } from '@/types'

/**
 * Jendela pengatur foto: kotak berisi foto utuh, dengan lingkaran yang
 * menandai bagian yang akan tampil. Foto bisa diseret dan diperbesar, dan
 * tetap bisa diseret setelah diperbesar.
 *
 * KENAPA KANVASNYA BUJUR SANGKAR DAN LINGKARANNYA MENYENTUH TEPI
 *
 * Lingkaran tempat foto ini akhirnya tampil juga bujur sangkar geometrinya —
 * object-fit: cover di dalam kotak 1:1, lalu disudutbulatkan. Kalau kanvas
 * penyunting ini bukan bujur sangkar, cover akan menghitung potongan yang
 * berbeda dan apa yang terlihat di sini tidak akan sama dengan hasilnya.
 * Dengan kanvas bujur sangkar dan lingkaran yang tepat terwakili di dalamnya,
 * gaya CSS-nya persis sama dengan yang dipakai di seluruh aplikasi
 * (photoStyle) — jadi ini pratinjau sungguhan, bukan tiruan.
 *
 * Bagian foto di luar lingkaran tidak disembunyikan tapi diredupkan: orang
 * perlu melihat apa yang sedang ia buang, bukan cuma apa yang ia simpan.
 */

/** Sisi kanvas penyunting dalam piksel. */
const KANVAS = 288

/** Langkah tombol +/− dan roda tetikus. */
const LANGKAH_ZOOM = 10

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  /** Nilai saat dialog dibuka. */
  value: PhotoFocus
  onSave: (focus: PhotoFocus) => void
  title?: string
}

export function PhotoCropDialog({ open, onOpenChange, src, value, onSave, title }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[352px]">
        <DialogHeader>
          <DialogTitle>{title ?? 'Atur Foto Profil'}</DialogTitle>
          <DialogDescription>
            Seret fotonya, lalu perbesar seperlunya. Yang di dalam lingkaran itulah
            yang akan tampil.
          </DialogDescription>
        </DialogHeader>

        {/*
          Isinya komponen tersendiri supaya rancangannya ikut dilepas saat
          dialog ditutup. Radix melepas anak DialogContent saat tertutup, jadi
          useState di dalam sana memulai ulang dari `value` tiap kali dibuka —
          tanpa perlu menyamakan lewat useEffect, yang justru memicu render
          berantai dan gampang menimpa apa yang sedang diatur pengguna.
        */}
        <PhotoCropCanvas
          src={src}
          value={value}
          onSave={f => { onSave(f); onOpenChange(false) }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function PhotoCropCanvas({
  src, value, onSave, onCancel,
}: {
  src: string
  value: PhotoFocus
  onSave: (focus: PhotoFocus) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<PhotoFocus>(value)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)

  // Titik pointer terakhir per jari — dua jari sekaligus berarti cubit.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ jarak: number; zoom: number } | null>(null)

  const rendered = coverSize(KANVAS, natural)

  function geser(dx: number, dy: number) {
    if (!rendered) return
    setDraft(f => ({
      ...f,
      x: jepit(f.x + panDelta(dx, { size: KANVAS, rendered: rendered.w, zoom: f.zoom })),
      y: jepit(f.y + panDelta(dy, { size: KANVAS, rendered: rendered.h, zoom: f.zoom })),
    }))
  }

  function ubahZoom(delta: number) {
    setDraft(f => ({ ...f, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, f.zoom + delta)) }))
  }

  function jarakDuaJari(): number {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      pinchStart.current = { jarak: jarakDuaJari(), zoom: draft.zoom }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const sebelum = pointers.current.get(e.pointerId)
    if (!sebelum) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Dua jari = cubit untuk memperbesar; satu jari = geser.
    if (pointers.current.size >= 2) {
      const mulai = pinchStart.current
      if (!mulai || mulai.jarak <= 0) return
      const rasio = jarakDuaJari() / mulai.jarak
      setDraft(f => ({
        ...f,
        zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(mulai.zoom * rasio))),
      }))
      return
    }

    geser(e.clientX - sebelum.x, e.clientY - sebelum.y)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Langkahnya dalam piksel layar, lalu diterjemahkan panDelta seperti
    // seretan — supaya jauhnya terasa sama di foto lebar maupun sempit.
    const langkah = e.shiftKey ? 24 : 8
    const arah: Record<string, [number, number]> = {
      ArrowLeft: [langkah, 0],
      ArrowRight: [-langkah, 0],
      ArrowUp: [0, langkah],
      ArrowDown: [0, -langkah],
    }
    if (arah[e.key]) {
      e.preventDefault()
      geser(arah[e.key][0], arah[e.key][1])
      return
    }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); ubahZoom(LANGKAH_ZOOM) }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); ubahZoom(-LANGKAH_ZOOM) }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div
          role="application"
          tabIndex={0}
          aria-label="Kanvas foto — seret untuk menggeser, tombol +/− untuk memperbesar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onWheel={e => ubahZoom(e.deltaY < 0 ? LANGKAH_ZOOM : -LANGKAH_ZOOM)}
          style={{ width: KANVAS, height: KANVAS }}
          className="relative max-w-full cursor-grab touch-none overflow-hidden rounded-lg bg-muted select-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Lapis bawah: foto utuh, diredupkan — bagian yang akan terbuang. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={e => setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })}
            className="h-full w-full opacity-30 select-none"
            style={photoStyle(draft)}
          />

          {/*
            Lapis atas: foto yang sama, kotak yang sama, hanya dipotong
            lingkaran. Ukuran kotaknya wajib identik dengan lapis bawah —
            object-fit: cover menghitung potongan dari ukuran wadahnya, jadi
            lingkaran yang lebih kecil akan meleset dari foto di belakangnya.
          */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ clipPath: 'circle(50% at 50% 50%)' }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-full select-none"
              style={photoStyle(draft)}
            />
          </div>

          {/* Cincin penanda batas lingkaran */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90 ring-inset"
            aria-hidden
          />
        </div>

        <div className="flex w-full max-w-[288px] items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => ubahZoom(-LANGKAH_ZOOM)}
            disabled={draft.zoom <= ZOOM_MIN}
            aria-label="Perkecil"
          >
            <Minus />
          </Button>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            value={draft.zoom}
            onChange={e => setDraft(f => ({ ...f, zoom: Number(e.target.value) }))}
            className="w-full accent-primary"
            aria-label="Perbesaran foto"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => ubahZoom(LANGKAH_ZOOM)}
            disabled={draft.zoom >= ZOOM_MAX}
            aria-label="Perbesar"
          >
            <Plus />
          </Button>
        </div>

        <div className="flex w-full max-w-[288px] items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Bisa juga pakai roda tetikus, cubit dua jari, atau tombol panah.
          </p>
          {!isDefaultFocus(draft) && (
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_FOCUS)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />Atur ulang
            </button>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
        <Button type="button" onClick={() => onSave(draft)}>Simpan Posisi</Button>
      </DialogFooter>
    </>
  )
}

const jepit = (n: number) => Math.min(100, Math.max(0, n))
