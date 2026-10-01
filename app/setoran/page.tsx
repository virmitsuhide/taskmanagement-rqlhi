import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewHalaqoh, JENJANG_LABELS } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { getGuruSetoranKoor } from '@/lib/data/setoran-koor'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { PilihGuruSetoran } from '@/components/setoran/PilihGuruSetoran'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ guru?: string; halaqoh?: string; periode?: string; jenis?: string }>
}

/**
 * Setoran siswa sebulan, dipilah per guru — Progres per Sesi milik guru,
 * dibuka dari sisi koordinator.
 *
 * Guru mencatat, koordinator membetulkan: klik sel untuk mengoreksi atau
 * menghapus setoran. Cakupan mengikuti canViewHalaqoh; tombol koreksi hanya
 * untuk halaqoh yang masuk canManageSetoran (koor SD melihat QULS tanpa
 * tombol), dan server memeriksanya lagi per siswa.
 */
export default async function SetoranKoorPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHalaqoh(session.role)) redirect('/dashboard')

  const q = await searchParams
  const periode = isValidPeriod(q.periode ?? '') ? q.periode! : currentPeriod()
  const jenis: JenisRekap = q.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  const daftarGuru = await getGuruSetoranKoor(session.role)
  const guru = daftarGuru.find(g => g.id === q.guru) ?? daftarGuru[0] ?? null
  const halaqoh = guru ? guru.halaqoh.find(h => h.id === q.halaqoh) ?? guru.halaqoh[0] ?? null : null
  const data = halaqoh ? await getProgresSesi(halaqoh.id, periode, jenis) : null
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Setoran Siswa' }]}
      />
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Rekap Setoran</p>
          <h1 className="text-3xl leading-tight">Setoran Siswa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran tiap anak sepanjang bulan, per guru.
            {halaqoh?.bisaSunting ? ' Klik angka di sel untuk mengoreksi atau menghapus setoran.' : ''}
          </p>
        </div>

        {!guru ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada guru yang mengampu halaqoh aktif di unit Anda.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PilihGuruSetoran
                daftar={daftarGuru.map(g => ({ id: g.id, nama: g.nama, jumlahSesi: g.halaqoh.length }))}
                terpilih={guru.id}
                query={`periode=${periode}&jenis=${jenis}`}
              />
              {(['tahsin', 'tahfidz'] as const).map(j => (
                <Link
                  key={j}
                  href={hrefRekap('/setoran', { guru: guru.id, halaqoh: halaqoh?.id, periode, jenis: j })}
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

            {halaqoh && (
              <FilterSesiBulan
                basePath="/setoran"
                daftar={guru.halaqoh}
                halaqoh={halaqoh.id}
                periode={periode}
                params={{ guru: guru.id, jenis }}
              />
            )}

            {halaqoh && (
              <p className="text-sm text-muted-foreground">
                {JENJANG_LABELS[halaqoh.jenjang]} · {halaqoh.name}
                {halaqoh.sesi ? ` · Sesi ${halaqoh.sesi}` : ''}
              </p>
            )}

            {!halaqoh || !data || data.baris.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di sesi ini.
              </div>
            ) : (
              <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/siswa/" bisaSunting={halaqoh.bisaSunting} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
