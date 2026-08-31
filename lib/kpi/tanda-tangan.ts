import type { CSSProperties } from 'react'
import type { SignatureFocus } from '@/types'

/**
 * Gambar tanda tangan: pembacaan, penataan, dan batas-batasnya.
 *
 * Sengaja terpisah dari lib/profil/foto.ts meski bentuk datanya mirip. Foto
 * profil DIPANGKAS di dalam lingkaran (object-fit: cover) — memang begitu
 * maunya. Tanda tangan tidak boleh dipangkas sedikit pun: coretan yang
 * terpotong tepi kotak bukan lagi tanda tangan orang itu. Karena itu di sini
 * object-fit-nya `contain`, dan zoom hanya boleh memperkecil-membesarkan di
 * dalam kotak, tidak pernah memotong.
 */

export const DEFAULT_TTD_FOCUS: SignatureFocus = { x: 50, y: 50, zoom: 100 }

export const TTD_ZOOM_MIN = 50
export const TTD_ZOOM_MAX = 200

/** Bucket khusus, bukan 'profile-photos'. Lihat catatan keamanan di bawah. */
export const TTD_BUCKET = 'signatures'
export const MAX_TTD_BYTES = 1 * 1024 * 1024

/**
 * Jenis berkas yang diterima.
 *
 * PNG lebih dulu dan itu bukan selera: tanda tangan yang berguna adalah yang
 * latarnya tembus pandang, sehingga garis tabel rapor tetap terlihat di
 * belakangnya. JPEG selalu membawa kotak putih dan akan menutupi garis nama di
 * bawahnya — diterima karena tidak semua orang punya PNG, tapi formulirnya
 * menganjurkan PNG.
 */
export const TTD_MIME = ['image/png', 'image/webp', 'image/jpeg']

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Baca signature_focus dari database.
 *
 * Kolomnya jsonb dan bisa berisi apa saja — baris lama (null), migrasi yang
 * belum dijalankan (undefined), atau angka di luar rentang. Dinormalkan di
 * satu tempat ini supaya pemanggilnya tidak perlu menjaga diri sendiri, sama
 * seperti parseFocus() di lib/profil/foto.ts.
 */
export function parseTtdFocus(raw: unknown): SignatureFocus {
  if (!raw || typeof raw !== 'object') return DEFAULT_TTD_FOCUS
  const o = raw as Record<string, unknown>
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    x: clamp(num(o.x, 50), 0, 100),
    y: clamp(num(o.y, 50), 0, 100),
    zoom: clamp(num(o.zoom, 100), TTD_ZOOM_MIN, TTD_ZOOM_MAX),
  }
}

/**
 * Gaya untuk <img> tanda tangan di dalam kotaknya.
 *
 * `contain` memastikan seluruh coretan masuk; objectPosition menentukan ke
 * mana ia bersandar bila kotaknya lebih lapang daripada gambarnya; scale
 * mengatur besarnya. transformOrigin ikut digeser bersama objectPosition
 * supaya keduanya bergerak searah — kalau tidak, memperbesar tanda tangan yang
 * sudah digeser ke kiri akan menariknya kembali ke tengah.
 */
export function ttdStyle(focus: SignatureFocus | null | undefined): CSSProperties {
  const f = focus ?? DEFAULT_TTD_FOCUS
  return {
    objectFit: 'contain',
    objectPosition: `${f.x}% ${f.y}%`,
    transform: f.zoom === 100 ? undefined : `scale(${f.zoom / 100})`,
    transformOrigin: `${f.x}% ${f.y}%`,
  }
}

/** Apakah penataannya masih bawaan — menyembunyikan tombol "Atur ulang". */
export function isDefaultTtdFocus(f: SignatureFocus): boolean {
  return f.x === 50 && f.y === 50 && f.zoom === 100
}

/**
 * Baca penataan dari FormData. Nama medannya `${name}_x`, `_y`, `_zoom` —
 * sebentuk focusFromFormData() di lib/profil/foto.ts.
 */
export function ttdFocusFromFormData(fd: FormData, name: string): SignatureFocus {
  return parseTtdFocus({
    x: Number(fd.get(`${name}_x`)),
    y: Number(fd.get(`${name}_y`)),
    zoom: Number(fd.get(`${name}_zoom`)),
  })
}
