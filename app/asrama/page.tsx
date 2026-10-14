import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageAsrama, canViewAsrama, canVerifikasiAsrama } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getBoardingTanpaKelompok, getKelompokAsrama } from '@/lib/data/asrama'
import { getCutiAsrama, getPengajuanNonaktif, terapkanPengajuanJatuhTempo } from '@/lib/data/asrama-status'
import { getProgresSesi, type JenisRekap } from '@/lib/data/rekap-sesi'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { LABEL_GENDER_ASRAMA } from '@/lib/rq/asrama'
import { PapanAsrama } from '@/components/asrama/PapanAsrama'
import { TabelProgres } from '@/components/setoran/TabelProgres'
import { FilterSesiBulan, hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ g?: string; tab?: string; kelompok?: string; periode?: string; jenis?: string }>
}

const CHIP = 'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors'
const AKTIF = 'border-primary bg-primary text-primary-foreground'
const PASIF = 'bg-card hover:bg-accent'

const EYEBROW: Record<string, string> = {
  div_quran_bpa: 'Div Qur’an BPA · Halaqoh Asrama',
  div_quran_bpi: 'Div Qur’an BPI · Halaqoh Asrama',
  koor_smp: 'Koordinator SMP · Halaqoh Asrama',
}

/**
 * Halaqoh asrama boarding SMPIT LHI (0110, 0119) — untuk Div Qur'an BPA/BPI,
 * Kepala RQ, Kumik, dan Koor SMP.
 *
 * Semua yang berhak melihat, melihat asrama putra DAN putri. Tombol ubah
 * hanya muncul untuk asrama yang menjadi wewenangnya (canManageAsrama), dan
 * server memeriksanya lagi di setiap tindakan. Pengajuan nonaktif
 * diverifikasi Koor SMP di /asrama/pengajuan.
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
  const bisaVerifikasi = canVerifikasiAsrama(session.role)

  // Pengajuan yang disetujui dan sudah sampai tanggal efektifnya dijalankan dulu.
  await terapkanPengajuanJatuhTempo()
  const [semua, calon, menungguSemua] = await Promise.all([
    getKelompokAsrama(),
    getBoardingTanpaKelompok(gender),
    bisaVerifikasi ? getPengajuanNonaktif({ status: 'menunggu' }) : Promise.resolve([]),
  ])
  const kelompok = semua.filter(k => k.gender === gender)
  const anak = kelompok.reduce((n, k) => n + k.anggota.length, 0)
  const jumlah = (g: 'L' | 'P') => semua.filter(k => k.gender === g).reduce((n, k) => n + k.anggota.length, 0)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} breadcrumbs={[{ label: 'Halaqoh Asrama' }]} />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-warm">{EYEBROW[session.role] ?? 'Boarding SMPIT LHI · Halaqoh Asrama'}</p>
            <h1 className="mt-2 font-heading text-3xl leading-tight md:text-4xl">
              {LABEL_GENDER_ASRAMA[gender]} — <em>{anak} anak di {kelompok.length} kelompok
              {calon.length > 0 ? `, ${calon.length} belum berkelompok` : ''}.</em>
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              Setiap anak boarding punya dua pengampu: pengampu sekolah dan pengampu asrama. Setoran keduanya melanjutkan progres yang sama.
            </p>
          </div>
          <div className="inline-flex shrink-0 self-start rounded-xl bg-muted p-1 lg:self-end">
            {(['L', 'P'] as const).map(g => (
              <Link key={g} href={hrefRekap('/asrama', { g, tab })} aria-current={g === gender ? 'page' : undefined}
                className={cn('rounded-lg px-4 py-2 text-sm font-bold', g === gender ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {LABEL_GENDER_ASRAMA[g]} · {g === 'L' ? 'BPA' : 'BPI'} {jumlah(g)}
              </Link>
            ))}
          </div>
        </div>

        {bisaVerifikasi && menungguSemua.length > 0 && (
          <Link href="/asrama/pengajuan" className="flex items-center justify-between gap-3 rounded-xl border border-accent-warm/40 bg-accent-warm-wash px-4 py-3 hover:bg-accent-warm-wash/70">
            <span className="text-sm"><b className="text-accent-warm">{menungguSemua.length} pengajuan nonaktif</b> menunggu verifikasi Anda.</span>
            <span className="text-sm font-bold text-accent-warm">Verifikasi →</span>
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {([['kelompok', 'Kelompok & level'], ['progres', 'Progres setoran']] as const).map(([t, label]) => (
            <Link key={t} href={hrefRekap('/asrama', { g: gender, tab: t })} aria-current={t === tab ? 'page' : undefined}
              className={cn(CHIP, t === tab ? AKTIF : PASIF)}>
              {label}
            </Link>
          ))}
          {bisaVerifikasi && (
            <Link href="/asrama/pengajuan" className={cn(CHIP, PASIF)}>Pengajuan nonaktif</Link>
          )}
          {!bisaUbah && <span className="text-xs text-muted-foreground">Hanya lihat — asrama ini dikelola pengurus lain.</span>}
        </div>

        {tab === 'kelompok'
          ? <TabKelompok gender={gender} kelompok={kelompok} calon={calon} bisaUbah={bisaUbah} bisaVerifikasi={bisaVerifikasi} />
          : <TabProgres gender={gender} kelompok={kelompok} bisaUbah={bisaUbah} q={q} />}
      </div>
    </div>
  )
}

async function TabKelompok({ gender, kelompok, calon, bisaUbah, bisaVerifikasi }: {
  gender: 'L' | 'P'
  kelompok: Awaited<ReturnType<typeof getKelompokAsrama>>
  calon: { id: string; nama: string; kelas: string | null }[]
  bisaUbah: boolean
  bisaVerifikasi: boolean
}) {
  const [cuti, pengajuan, guruRes] = await Promise.all([
    getCutiAsrama(),
    getPengajuanNonaktif({ gender, sejakHari: 60, batas: 50 }),
    bisaUbah
      ? createServerClient().from('teachers').select('id, full_name').eq('is_active', true).is('deleted_at', null).order('full_name')
      : Promise.resolve({ data: [] }),
  ])
  const guru = ((guruRes.data ?? []) as { id: string; full_name: string }[]).map(g => ({ id: g.id, nama: g.full_name }))

  return (
    <PapanAsrama
      gender={gender}
      kelompok={kelompok}
      calon={calon}
      cuti={Object.fromEntries(cuti)}
      pengajuan={pengajuan}
      guru={guru}
      bisaUbah={bisaUbah}
      bisaVerifikasi={bisaVerifikasi}
    />
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
  const KECIL = 'rounded-lg border px-3 py-1.5 text-sm transition-colors'
  const KECIL_AKTIF = 'border-primary bg-primary-wash font-semibold text-primary'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {kelompok.map(k => (
          <Link key={k.id} href={hrefRekap('/asrama', { ...dasar, kelompok: k.id, jenis })}
            aria-current={k.id === terpilih.id ? 'page' : undefined}
            className={cn(KECIL, k.id === terpilih.id ? KECIL_AKTIF : PASIF)}>
            {k.nama}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['tahsin', 'tahfidz'] as const).map(j => (
          <Link key={j} href={hrefRekap('/asrama', { ...dasar, jenis: j })} aria-current={j === jenis ? 'page' : undefined}
            className={cn(KECIL, j === jenis ? KECIL_AKTIF : PASIF)}>
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
