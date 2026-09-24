import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getAbsensiBulan } from '@/lib/data/absensi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { FilterSesiBulan } from '@/components/setoran/FilterSesiBulan'
import { TabelAbsensi } from '@/components/guru/TabelAbsensi'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string; periode?: string }>
}

/**
 * Daftar hadir satu sesi sepanjang sebulan — siswa × tanggal.
 *
 * Layar harian menjawab "siapa yang datang hari ini"; yang ini menjawab
 * "bagaimana sebulan ini" — termasuk pertemuan yang terlewat diabsen, yang
 * tidak mungkin terlihat dari layar harian karena hari yang belum disentuh
 * tidak meninggalkan jejak apa pun di sana.
 *
 * Bentuknya sengaja dikembarkan dengan Progres per Sesi: keduanya dibaca
 * berdampingan tiap akhir bulan.
 */
export default async function RekapAbsensiPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const periode = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const daftar = await getHalaqohSesiGuru(session.teacherId)
  const halaqoh = pilihHalaqoh(daftar, params.halaqoh)
  const data = halaqoh ? await getAbsensiBulan(halaqoh.id, periode) : null
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <Link href="/guru/absensi" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Daftar hadir harian
          </Link>
          <h1 className="mt-1 text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Rekap Kehadiran
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kehadiran tiap anak sepanjang bulan. Arahkan kursor ke sel untuk keterangannya, atau ketuk nama anak untuk profilnya.
          </p>
        </div>

        {!halaqoh || !data ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh aktif.
          </div>
        ) : !data.tabelAda ? (
          <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
            Tabel absensi belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0081_absensi_harian_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu.
          </div>
        ) : (
          <>
            <FilterSesiBulan
              basePath="/guru/absensi/rekap"
              daftar={daftar}
              halaqoh={halaqoh.id}
              periode={periode}
            />

            {data.baris.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di sesi ini.
              </div>
            ) : (
              <TabelAbsensi data={data} hariIni={hariIni} tautanSiswa="/guru/siswa/" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
