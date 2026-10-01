import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getKelompokAsrama } from '@/lib/data/asrama'
import { getSiswaSesiTahfidz, getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { LABEL_GENDER_ASRAMA } from '@/lib/rq/asrama'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import { SetoranSesiTahfidz, type SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { cn } from '@/lib/utils'

type Tab = 'tahsin' | 'tahfidz' | 'progres'

interface PageProps {
  searchParams: Promise<{ kelompok?: string; tab?: string; periode?: string; jenis?: string }>
}

/**
 * Halaqoh asrama untuk pengampunya (0110) — setor tahsin, setor tahfidz,
 * dan progres sebulan, untuk anggota kelompok asrama yang ia ampu.
 *
 * Setoran di sini dicatat lewat jalur asrama: melanjutkan progres yang sama
 * dengan sekolah, tapi tidak menimpa setoran sekolah di tanggal yang sama.
 */
export default async function AsramaGuruPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const q = await searchParams
  const daftar = await getKelompokAsrama({ pengampuId: session.teacherId })
  const kelompok = daftar.find(k => k.id === q.kelompok) ?? daftar[0] ?? null
  const tab: Tab = q.tab === 'tahfidz' || q.tab === 'progres' ? q.tab : 'tahsin'
  const periode = isValidPeriod(q.periode ?? '') ? q.periode! : currentPeriod()
  const jenis: JenisRekap = q.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const ids = kelompok?.anggota.map(a => a.student_id) ?? []
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  const surat = tab === 'progres' ? [] : ((await createServerClient()
    .from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id')).data ?? []) as SuratPilihan[]

  const href = (p: Record<string, string | undefined>) =>
    hrefRekap('/guru/asrama', { kelompok: kelompok?.id, ...p })

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Halaqoh Asrama</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            {kelompok ? kelompok.nama : 'Asrama'}
          </h1>
          {kelompok && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {LABEL_GENDER_ASRAMA[kelompok.gender]} · {kelompok.anggota.length} anak.
              Setoran di sini melanjutkan progres sekolah anak; guru halaqoh sekolahnya ikut melihatnya.
            </p>
          )}
        </div>

        {!kelompok ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum ditetapkan sebagai pengampu kelompok asrama.
          </div>
        ) : (
          <>
            {daftar.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih kelompok">
                {daftar.map(k => (
                  <Link
                    key={k.id}
                    href={hrefRekap('/guru/asrama', { kelompok: k.id, tab })}
                    aria-current={k.id === kelompok.id ? 'page' : undefined}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                      k.id === kelompok.id ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                    )}
                  >
                    {k.nama}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tampilan asrama">
              {([
                ['tahsin', 'Setor Tahsin'],
                ['tahfidz', 'Setor Tahfidz'],
                ['progres', 'Progres'],
              ] as const).map(([kunci, label]) => (
                <Link
                  key={kunci}
                  href={href({ tab: kunci })}
                  role="tab"
                  aria-selected={tab === kunci}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    tab === kunci ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {ids.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Kelompok ini belum punya anggota.
              </div>
            ) : tab === 'tahsin' ? (
              <SetoranSesiTahsin
                key={kelompok.id}
                siswa={await getSiswaSesiTahsin({ siswa: ids })}
                surat={surat}
                halaqohId=""
                pengaturan={null}
                asrama
              />
            ) : tab === 'tahfidz' ? (
              <SetoranSesiTahfidz
                key={kelompok.id}
                siswa={await getSiswaSesiTahfidz({ siswa: ids })}
                surat={surat}
                asrama
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(['tahsin', 'tahfidz'] as const).map(j => (
                    <Link
                      key={j}
                      href={href({ tab: 'progres', periode, jenis: j })}
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
                <FilterSesiBulan
                  basePath="/guru/asrama"
                  daftar={[]}
                  halaqoh=""
                  periode={periode}
                  params={{ kelompok: kelompok.id, tab: 'progres', jenis }}
                />
                <TabelProgres
                  data={await getProgresSesi({ siswa: ids }, periode, jenis)}
                  jenis={jenis}
                  hariIni={hariIni}
                  tautanSiswa="/guru/siswa/"
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
