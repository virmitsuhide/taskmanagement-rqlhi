import { readFile } from 'node:fs/promises'

/**
 * Logo mark sebagai data URL untuk dipakai di dalam `ImageResponse` (next/og).
 *
 * Satori tidak bisa memuat aset lewat path relatif atau `next/image`, jadi PNG-nya
 * di-inline sebagai base64. File-nya dirujuk lewat `import.meta.url` supaya ikut
 * ter-trace oleh bundler saat deploy — bukan lewat `process.cwd()` yang tidak
 * dijamin membawa isi `public/` ke dalam bundle server.
 *
 * Sengaja pakai varian 128px (~12 KB) — cukup tajam untuk badge OG 56–72px
 * tanpa membengkakkan payload tiap render.
 */
let cached: string | null = null

export async function getOgLogo(): Promise<string> {
  if (!cached) {
    const buf = await readFile(new URL('./logo-mark-128.png', import.meta.url))
    cached = `data:image/png;base64,${buf.toString('base64')}`
  }
  return cached
}
