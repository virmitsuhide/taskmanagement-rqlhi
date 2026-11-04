import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Akun ini tidak boleh membuka halaman yang diminta.
 *
 * Dulu halaman seperti itu diam-diam mengalihkan ke /dashboard, sehingga
 * pengguna merasa "terlempar" tanpa tahu sebabnya — dan mengira tautannya
 * rusak. Kini ia dibawa ke /akses-ditolak yang menyebut akunnya, halaman yang
 * dituju, dan jalan kembali. Alamat asal dibaca dari x-pathname (proxy.ts).
 */
export async function tolakAkses(): Promise<never> {
  const dari = (await headers()).get('x-pathname')
  redirect(dari ? `/akses-ditolak?dari=${encodeURIComponent(dari)}` : '/akses-ditolak')
}
