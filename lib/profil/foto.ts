import type { CSSProperties } from 'react'
import type { PhotoFocus } from '@/types'

export const DEFAULT_FOCUS: PhotoFocus = { x: 50, y: 50, zoom: 100 }

export const ZOOM_MIN = 100
export const ZOOM_MAX = 250

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Baca photo_focus dari database. Kolomnya jsonb dan bisa berisi apa saja —
 * baris lama (null), migrasi yang belum jalan (undefined), atau angka di luar
 * rentang. Semua dinormalkan di satu tempat ini supaya pemanggilnya tidak
 * perlu menjaga diri sendiri.
 */
export function parseFocus(raw: unknown): PhotoFocus {
  if (!raw || typeof raw !== 'object') return DEFAULT_FOCUS
  const o = raw as Record<string, unknown>
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    x: clamp(num(o.x, 50), 0, 100),
    y: clamp(num(o.y, 50), 0, 100),
    zoom: clamp(num(o.zoom, 100), ZOOM_MIN, ZOOM_MAX),
  }
}

/**
 * Gaya untuk <img> di dalam wadah bulat. Wadahnya wajib punya overflow-hidden:
 * zoom > 100 membuat gambar lebih besar dari lingkarannya, dan tanpa itu
 * kelebihannya akan tumpah ke luar bingkai.
 */
export function photoStyle(focus: PhotoFocus | null | undefined): CSSProperties {
  const f = focus ?? DEFAULT_FOCUS
  return {
    objectFit: 'cover',
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom === 100 ? undefined : `scale(${f.zoom / 100})`,
  }
}

/** Apakah posisinya masih bawaan — dipakai untuk menyembunyikan tombol "Atur ulang". */
export function isDefaultFocus(f: PhotoFocus): boolean {
  return f.x === 50 && f.y === 50 && f.zoom === 100
}

/**
 * Baca nilai PhotoAdjuster dari FormData. Nama fieldnya mengikuti awalan yang
 * dipakai komponen: `${name}_x`, `${name}_y`, `${name}_zoom`.
 */
export function focusFromFormData(fd: FormData, name: string): PhotoFocus {
  return parseFocus({
    x: Number(fd.get(`${name}_x`)),
    y: Number(fd.get(`${name}_y`)),
    zoom: Number(fd.get(`${name}_zoom`)),
  })
}
