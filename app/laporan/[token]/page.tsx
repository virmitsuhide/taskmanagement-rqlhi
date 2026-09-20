import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Lora, Playfair_Display } from 'next/font/google'
import { verifyLaporanToken } from '@/lib/rapor-token'
import { createServerClient } from '@/lib/supabase/server'
import { getLaporanOrtu } from '@/lib/data/laporan-ortu'
import { rentangLaporan, type LaporanOrtu } from '@/lib/rq/laporan-ortu'
import { LembarLaporanOrtu } from '@/components/rapor/LembarLaporanOrtu'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

interface PageProps {
  params: Promise<{ token: string }>
}

/**
 * Laporan orang tua satu sesi — tautan publik untuk grup wali, tanpa login.
 *
 * Bentuk lembarnya sama persis dengan yang dilihat guru: satu komponen
 * dipakai keduanya. Yang berbeda hanya bingkainya — di sini tanpa alat
 * penyunting, dan tanpa indeks mesin pencari.
 */
async function muat(token: string): Promise<LaporanOrtu | null> {
  const isi = await verifyLaporanToken(token)
  if (!isi) return null

  const supabase = createServerClient()
  const { data: halaqoh } = await supabase
    .from('halaqoh').select('id, name, sesi, jenjang').eq('id', isi.hid).maybeSingle()
  if (!halaqoh) return null

  // Tanggal dibekukan di token; 'rentang' memakainya apa adanya.
  const periode = rentangLaporan('rentang', isi.s, { dari: isi.d, sampai: isi.s })
  return getLaporanOrtu(isi.tid, halaqoh as HalaqohSesi, periode)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const laporan = await muat(token)
  if (!laporan) return { title: 'Laporan tidak ditemukan' }

  const title = `Laporan ${laporan.sesi.nama} — ${laporan.periode.label}`
  const description =
    `Capaian pembelajaran Al-Qur'an ${laporan.ringkas.jumlahAnak} Ananda · ${laporan.guru.nama} · Rumah Qur'an LHI`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    // Laporan ini menyebut nama anak-anak: tidak boleh masuk mesin pencari.
    robots: { index: false, follow: false },
  }
}

export default async function LaporanPublikPage({ params }: PageProps) {
  const { token } = await params
  const laporan = await muat(token)
  if (!laporan) notFound()

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen px-4 py-8`}
      style={{ background: 'var(--secondary)', fontFamily: 'var(--font-lora), Georgia, serif' }}
    >
      <div className="mx-auto max-w-3xl">
        <LembarLaporanOrtu l={laporan} />
        <p className="mt-6 text-center text-xs text-muted-foreground print:hidden">
          Laporan digital Rumah Qur&apos;an LHI · Dibagikan oleh pengampu sesi.
        </p>
      </div>
    </div>
  )
}
