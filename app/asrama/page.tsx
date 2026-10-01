import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageAsrama, canViewAsrama } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getBoardingTanpaKelompok, getKelompokAsrama } from '@/lib/data/asrama'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { LABEL_GENDER_ASRAMA } from '@/lib/rq/asrama'
import { KartuKelompok, TambahKelompok } from '@/components/asrama/KartuKelompok'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ g?: string; tab?: string; kelompok?: string; periode?: string; jenis?: string }>
}

const CHIP = 'rounded-lg border px-3 py-1.5 text-sm transition-colors'
const AKTIF = 'border-primary bg-primary-wash font-semibold text-primary'
const PASIF = 'bg-card hover:bg-accent'

/**
 * Halaqoh asrama boarding SMPIT LHI (0110) — untuk Div Qur'an BPA/BPI,
 * Kepala RQ, Kumik, dan Koor SMP.
 *
 * Semua yang berhak melihat, melihat asrama putra DAN putri. Tombol ubah
 * hanya muncul untuk asrama yang menjadi wewenangnya (canManageAsrama), dan
 * server memeriksanya lagi di setiap tindakan.
 */
export default async function AsramaPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAsrama(session.role)) redirect('/dashboard')

  const q = await searchParams
  // Pengelola dibuka langsung di asramanya sendiri.
  const gender: 'L' | 'P' = q.g === 'P' || q.g === 'L' ? q.g : session.role === 'div_quran_bpi' ? 'P' : 'L'
  const tab = q.tab === 'progres' ? 'progres' : 'kelompok'
  const bisaUbah = canManageAsrama(session.role, gender)

  const semua = await getKelompokAsrama()
  const kelompok = semua.filter(k => k.gender === gender)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} breadcrumbs={[{ label: 'Halaqoh Asrama' }]} />
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Boarding SMPIT LHI</p>
          <h1 className="text-3xl leading-tight">Halaqoh Asrama</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Anak boarding punya dua pengampu: pengampu sekolah (halaqoh sekolah) dan pengampu asrama (kelompok di sini).
            Setoran keduanya melanjutkan progres yang sama.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['L', 'P'] as const).map(g => (
            <Link key={g} href={hrefRekap('/asrama', { g, tab })} aria-current={g === gender ? 'page' : undefined}
              className={cn(CHIP, g === gender ? AKTIF : PASIF)}>
              {LABEL_GENDER_ASRAMA[g]}
              <span className="ml-1.5 text-xs text-muted-foreground">{semua.filter(k => k.gender === g).reduce((n, k) => n + k.anggota.length, 0)}</span>
            </Link>
          ))}
          <span className="mx-1 h-6 w-px bg-border" />
          {([['kelompok', 'Kelompok & Level'], ['progres', 'Progres Setoran']] as const).map(([t, label]) => (
            <Link key={t} href={hrefRekap('/asrama', { g: gender, tab: t })} aria-current={t === tab ? 'page' : undefined}
              className={cn(CHIP, t === tab ? AKTIF : PASIF)}>
              {label}
            </Link>
          ))}
          {!bisaUbah && <span className="text-xs text-muted-foreground">Hanya lihat — asrama ini dikelola pengurus lain.</span>}
        </div>

        {tab === 'kelompok'
          ? <TabKelompok gender={gender} kelompok={kelompok} bisaUbah={bisaUbah} />
          : <TabProgres gender={gender} kelompok={kelompok} bisaUbah={bisaUbah} q={q} />}
      </div>
    </div>
  )
}

async function TabKelompok({ gender, kelompok, bisaUbah }: {
  gender: 'L' | 'P'
  kelompok: Awaited<ReturnType<typeof getKelompokAsrama>>
  bisaUbah: boolean
}) {
  const [calon, guruRes] = await Promise.all([
    bisaUbah ? getBoardingTanpaKelompok(gender) : Promise.resolve([]),
    bisaUbah
      ? createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name')
      : Promise.resolve({ data: [] }),
  ])
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).map(g => ({ id: g.id, nama: g.full_name }))

  return (
    <div className="space-y-3">
      {calon.length > 0 && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {calon.length} anak boarding {gender === 'L' ? 'putra' : 'putri'} belum masuk kelompok:{' '}
          {calon.slice(0, 8).map(c => c.nama.split(' ').slice(0, 2).join(' ')).join(', ')}{calon.length > 8 ? ', …' : ''}.
        </p>
      )}
      {kelompok.length === 0 && (
        <p className="text-sm text-muted-foreground">Belum ada kelompok {LABEL_GENDER_ASRAMA[gender].toLowerCase()}.</p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {kelompok.map(k => <KartuKelompok key={k.id} kelompok={k} guru={guru} calon={calon} bisaUbah={bisaUbah} />)}
      </div>
      {bisaUbah && <TambahKelompok gender={gender} guru={guru} />}
    </div>
  )
}

async function TabProgres({ gender, kelompok, bisaUbah, q }: {
  gender: 'L' | 'P'
  kelompok: Awaited<ReturnType<typeof getKelompokAsrama>>
  bisaUbah: boolean
  q: { kelompok?: string; periode?: string; jenis?: string }
}) {
  const terpilih = kelompok.find(k => k.id === q.kelompok) ?? kelompok[0] ?? null
  const periode = isValidPeriod(q.periode ?? '') ? q.periode! : currentPeriod()
  const jenis: JenisRekap = q.jenis === 'tahfidz' ? 'tahfidz' : 'tahsin'
  const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  if (!terpilih) return <p className="text-sm text-muted-foreground">Belum ada kelompok.</p>

  const dasar = { g: gender, tab: 'progres', kelompok: terpilih.id, periode }
  const data = await getProgresSesi({ siswa: terpilih.anggota.map(a => a.student_id) }, periode, jenis)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {kelompok.map(k => (
          <Link key={k.id} href={hrefRekap('/asrama', { ...dasar, kelompok: k.id, jenis })}
            aria-current={k.id === terpilih.id ? 'page' : undefined}
            className={cn(CHIP, k.id === terpilih.id ? AKTIF : PASIF)}>
            {k.nama}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['tahsin', 'tahfidz'] as const).map(j => (
          <Link key={j} href={hrefRekap('/asrama', { ...dasar, jenis: j })} aria-current={j === jenis ? 'page' : undefined}
            className={cn(CHIP, j === jenis ? AKTIF : PASIF)}>
            {j === 'tahsin' ? 'Tahsin' : 'Tahfidz'}
          </Link>
        ))}
      </div>
      <FilterSesiBulan basePath="/asrama" daftar={[]} halaqoh="" periode={periode} params={{ g: gender, tab: 'progres', kelompok: terpilih.id, jenis }} />
      <p className="text-xs text-muted-foreground">
        Pengampu asrama: {terpilih.pengampu_nama ?? 'belum ditetapkan'}. Tabel memuat setoran sekolah dan asrama
        (ditandai <b>A</b>).{bisaUbah ? ' Klik angka di sel untuk mengoreksi atau menghapus.' : ''}
      </p>
      {data.baris.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kelompok ini belum punya anggota aktif.</p>
      ) : (
        <TabelProgres data={data} jenis={jenis} hariIni={hariIni} tautanSiswa="/siswa/" bisaSunting={bisaUbah} />
      )}
    </div>
  )
}
