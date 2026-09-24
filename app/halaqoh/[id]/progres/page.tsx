import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageSetoran, canViewHalaqoh, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { PilihHalaqohProgres } from '@/components/halaqoh/PilihHalaqohProgres'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periode?: string; jenis?: string }>
}

/**
 * Progres setoran satu halaqoh untuk koordinator — tabel yang sama dengan
 * milik guru, ditambah koreksi: klik sel untuk membetulkan halaman, status,
 * nilai bacaan, dan nilai adab.
 *
 * Guru mencatat, koordinator membetulkan (lihat actions/setoran-koreksi).
 * Koordinator yang hanya berhak memantau (koor SD atas QULS) melihat tabel
 * tanpa tombol koreksi.
 */
export default async function ProgresHalaqohPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const q = await searchParams
  const periode = isValidPeriod(q.periode ?? '') ? q.periode! : currentPeriod()
  const jenis: JenisRekap = q.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'

  const supabase = createServerClient()
  const { data: halaqoh } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, program, sesi')
    .eq('id', id)
    .maybeSingle()
  if (!halaqoh) notFound()
  const jenjang = halaqoh.jenjang as Jenjang
  if (!canViewHalaqoh(session.role, jenjang, halaqoh.program as string | null)) redirect('/halaqoh')

  const [data, { data: semua }] = await Promise.all([
    getProgresSesi(id, periode, jenis),
    supabase.from('halaqoh').select('id, name, jenjang, program, sesi').eq('is_active', true).order('jenjang').order('sesi').order('name'),
  ])

  const daftar = ((semua ?? []) as { id: string; name: string; jenjang: Jenjang; program: string | null; sesi: number | null }[])
    .filter(h => canViewHalaqoh(session.role, h.jenjang, h.program))
    .map(h => ({ id: h.id, label: `${JENJANG_LABELS[h.jenjang]} · ${h.name}` }))
  // Halaqoh nonaktif yang dibuka langsung tetap bisa dipilih di daftarnya.
  if (!daftar.some(h => h.id === id)) daftar.unshift({ id, label: `${JENJANG_LABELS[jenjang]} · ${halaqoh.name}` })

  const bisaSunting = canManageSetoran(session.role, jenjang, halaqoh.program as string | null)
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[
          { label: 'Halaqoh', href: '/halaqoh' },
          { label: halaqoh.name, href: `/halaqoh/${id}` },
          { label: 'Progres Setoran' },
        ]}
        showBack
      />
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Progres Setoran</p>
          <h1 className="text-3xl leading-tight">{halaqoh.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Setoran tiap anak per hari sekolah.
            {bisaSunting ? ' Klik angka di sel untuk mengoreksi halaman, status, nilai bacaan, atau nilai adab.' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PilihHalaqohProgres daftar={daftar} terpilih={id} query={`periode=${periode}&jenis=${jenis}`} />
          {(['tahsin', 'tahfidz'] as const).map(j => (
            <Link
              key={j}
              href={hrefRekap(`/halaqoh/${id}/progres`, { periode, jenis: j })}
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

        <FilterSesiBulan basePath={`/halaqoh/${id}/progres`} daftar={[]} halaqoh="" periode={periode} params={{ jenis }} />

        {data.baris.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Belum ada siswa aktif di halaqoh ini.
          </div>
        ) : (
          <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/siswa/" bisaSunting={bisaSunting} />
        )}
      </div>
    </div>
  )
}
