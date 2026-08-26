import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Button } from '@/components/ui/button'
import { RekapUjian } from '@/components/ujian/RekapUjian'
import { UjianTabPublik } from '@/components/ujian/UjianTabPublik'
import { getRekapUjian } from '@/lib/data/ujian'
import { getSession } from '@/lib/auth/session'
import { canViewUjian } from '@/lib/auth/permissions'
import { BULAN_ID } from '@/lib/rq/ujian'

export const metadata: Metadata = {
  title: "Rekap Hasil Ujian — Rumah Qur'an LHI",
  description: 'Hasil ujian tahsin & tahfidz yang sudah terlaksana, per bulan.',
}

interface PageProps {
  searchParams: Promise<{ bulan?: string; tahun?: string }>
}

/** Bulan/tahun dari URL, dijaga tetap masuk akal walau isinya diketik sembarang. */
function periode(params: { bulan?: string; tahun?: string }) {
  const sekarang = new Date()
  const bulan = Number(params.bulan)
  const tahun = Number(params.tahun)
  return {
    month: Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 ? bulan : sekarang.getMonth() + 1,
    year: Number.isInteger(tahun) && tahun >= 2000 && tahun <= 2100 ? tahun : sekarang.getFullYear(),
  }
}

export default async function RekapUjianPage({ searchParams }: PageProps) {
  const { month, year } = periode(await searchParams)

  // Tombol unduh Excel hanya untuk pengurus yang memang mengelola ujian.
  // Halamannya sendiri terbuka untuk umum — yang dibatasi hanya kemampuan
  // menarik seluruh data sebulan sekaligus menjadi berkas.
  const [{ tahfidz, tahsin }, session] = await Promise.all([
    getRekapUjian(month, year),
    getSession(),
  ])
  const bolehKelola = Boolean(session && canViewUjian(session.role))

  return (
    <div>
      <PublicHeader />

      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-[50vh]">
        <Link
          href="/ujian"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Kembali ke Antrian Ujian
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Rekap Hasil Ujian</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ujian tahsin &amp; tahfidz yang sudah terlaksana pada {BULAN_ID[month - 1]} {year}
            </p>
          </div>
          {bolehKelola && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/ujian/riwayat">
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Riwayat per Penguji
              </Link>
            </Button>
          )}
        </div>

        <UjianTabPublik aktif="rekap" />

        <div className="pb-10">
          <RekapUjian
            tahfidz={tahfidz}
            tahsin={tahsin}
            month={month}
            year={year}
            bolehEkspor={bolehKelola}
          />
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
