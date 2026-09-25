import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string; periode?: string; jenis?: string }>
}

/**
 * Progres setoran satu sesi dalam sebulan — siswa × tanggal.
 *
 * Kolomnya semua hari Senin–Jumat (Sabtu–Ahad libur) — dibaca seperti buku
 * absen: sel kosong berarti anak tidak setor hari itu. Garis tebal memisahkan
 * pekan, supaya "Senin ketiga" bisa ditemukan tanpa menghitung kolom.
 */
export default async function ProgresSesiPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const periode = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()
  const jenis: JenisRekap = params.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  const daftar = await getHalaqohSesiGuru(session.teacherId)
  const halaqoh = pilihHalaqoh(daftar, params.halaqoh)
  const data = halaqoh ? await getProgresSesi(halaqoh.id, periode, jenis) : null
  // Tanggal WIB hari ini — penanda kolom dan pemisah hari yang belum tiba.
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Progres per Sesi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran tiap anak sepanjang bulan. Arahkan kursor ke sel untuk rincian, atau ketuk nama anak untuk riwayat lengkapnya.
          </p>
        </div>

        <div className="flex gap-2" role="group" aria-label="Jenis setoran">
          {(['tahsin', 'tahfidz'] as const).map(j => (
            <Link
              key={j}
              href={hrefRekap('/guru/progres', { halaqoh: halaqoh?.id, periode, jenis: j })}
              aria-current={j === jenis ? 'page' : undefined}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                j === jenis ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
              )}
            >
              {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
            </Link>
          ))}
        </div>

        {!halaqoh || !data ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh. Hubungi admin untuk assign halaqoh.
          </div>
        ) : (
          <>
            <FilterSesiBulan
              basePath="/guru/progres"
              daftar={daftar}
              halaqoh={halaqoh.id}
              periode={periode}
              params={{ jenis }}
            />

            {data.baris.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa di sesi ini.
              </div>
            ) : (
              <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/guru/siswa/" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
