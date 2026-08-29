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
 *
 * KENAPA transform-origin IKUT DIGESER BERSAMA object-position
 *
 * object-position hanya bisa menggeser sebatas kelebihan yang dihasilkan
 * object-fit: cover — dan pada foto yang sudah nyaris bujur sangkar,
 * kelebihannya nol. Dulu itu berarti foto yang diperbesar terkunci di tengah:
 * zoom membuat gambarnya lebih besar dari lingkaran, tapi tidak ada satu pun
 * nilai object-position yang bisa menjangkau bagian yang terpotong.
 *
 * transform-origin menutup lubang itu. scale() memuai dari titik ini, jadi
 * memindahkan titiknya memindahkan bagian mana yang tersisa di dalam
 * lingkaran — dan cakupannya seluruh bidang gambar, bukan cuma kelebihannya.
 * Keduanya diberi koordinat yang sama dan bekerja searah, jadi satu pasang
 * (x, y) tetap cukup untuk menyatakan "bagian ini yang saya mau".
 *
 * Nilai lama tetap terbaca sama persis: pada zoom 100 scale-nya tidak ada
 * sehingga origin tak berpengaruh, dan pada x/y 50 origin-nya memang sudah
 * nilai bawaan CSS.
 */
export function photoStyle(focus: PhotoFocus | null | undefined): CSSProperties {
  const f = focus ?? DEFAULT_FOCUS
  return {
    objectFit: 'cover',
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom === 100 ? undefined : `scale(${f.zoom / 100})`,
    transformOrigin: f.zoom === 100 ? undefined : `${f.x}% ${f.y}%`,
  }
}

/**
 * Berapa persen (x, y) harus bergeser agar isi lingkaran mengikuti seretan
 * sejauh (dx, dy) piksel layar.
 *
 * Dipisahkan dari komponennya karena inilah satu-satunya bagian yang bisa
 * salah tanpa terlihat: kalau pembaginya keliru, foto tetap bergerak — hanya
 * saja terlalu cepat atau terlalu lambat dibanding jari penggunanya.
 *
 * Turunannya. Kotak elemen berukuran size×size; cover menggambar foto sebesar
 * rendered×rendered' di dalamnya, jadi kelebihan yang bisa dijangkau
 * object-position adalah (rendered − size). scale(z) beroperasi dari titik
 * origin, menambah jangkauan sebesar size(z − 1). Isi jendela tampak diperbesar
 * z kali, sehingga satu piksel layar bernilai 1/z piksel elemen:
 *
 *     Δpersen = −100 · d / ( size(z − 1) + z(rendered − size) )
 *
 * Tandanya negatif karena menyeret ke kanan harus memunculkan bagian KIRI foto.
 * Penyebut nol berarti memang tidak ada yang bisa digeser di sumbu itu (foto
 * pas sebesar lingkaran dan belum diperbesar) — di situ hasilnya 0.
 */
export function panDelta(
  d: number,
  opts: { size: number; rendered: number; zoom: number },
): number {
  const z = opts.zoom / 100
  const jangkauan = opts.size * (z - 1) + z * (opts.rendered - opts.size)
  if (jangkauan <= 0) return 0
  return (-100 * d) / jangkauan
}

/**
 * Ukuran foto setelah object-fit: cover di dalam kotak bujur sangkar.
 * Mengembalikan null selama dimensi asli gambar belum diketahui.
 */
export function coverSize(
  size: number,
  natural: { w: number; h: number } | null,
): { w: number; h: number } | null {
  if (!natural || natural.w <= 0 || natural.h <= 0) return null
  const skala = Math.max(size / natural.w, size / natural.h)
  return { w: natural.w * skala, h: natural.h * skala }
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
