import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, UserSearch, CircleX, CheckCircle2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits } from '@/lib/auth/permissions'
import { getStatusHafalan, type StatusHafalanSiswa } from '@/lib/data/verifikasi-riwayat'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { KartuVerifikasi } from '@/components/ujian/KartuVerifikasi'
import { labelKewajiban as labelButir } from '@/lib/rq/hafalan'
import { DashTop, KpiCard, Panel, Slicer, hrefDengan } from '@/components/dashboard/kit'
import type { UjianUnit } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; status?: string; q?: string }>
}

type Tampil = 'perlu' | 'belum' | 'selesai'
const PATH = '/ujian/verifikasi'

/**
 * Verifikasi riwayat ujian tahfidz. Sistem ini baru, sehingga banyak anak
 * yang setorannya sudah jauh — mis. juz 2 — tanpa satu pun catatan ujian untuk
 * juz yang sudah ia lewati. Halaman ini menemukan mereka dari setorannya, lalu
 * koordinator memutuskan per ujian: sudah atau belum dilaksanakan.
 */
export default async function VerifikasiRiwayatPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const semuaUnit = getUjianUnits(session.role)
  const unit = semuaUnit.includes(sp.unit as UjianUnit) ? (sp.unit as UjianUnit) : null
  const tampil: Tampil = sp.status === 'belum' || sp.status === 'selesai' ? sp.status : 'perlu'
  const cari = (sp.q ?? '').trim().toLowerCase()

  const { siswa, tabelVerifikasiAda } = await getStatusHafalan(unit ? [unit] : semuaUnit)
  const hitung = (s: StatusHafalanSiswa, st: string) => s.butir.filter(b => b.status === st).length
  const relevan = siswa.filter(s => s.butir.length > 0)

  const perlu = relevan.filter(s => hitung(s, 'perlu') > 0)
  const belum = relevan.filter(s => hitung(s, 'belum') > 0)
  const selesai = relevan.filter(s => hitung(s, 'perlu') === 0 && hitung(s, 'belum') === 0)
  const daftarAwal = tampil === 'perlu' ? perlu : tampil === 'belum' ? belum : selesai
  const daftar = (cari ? daftarAwal.filter(s => s.nama.toLowerCase().includes(cari)) : daftarAwal)
    // Paling banyak yang belum diperiksa di atas: dampaknya ke juz teruji paling besar.
    .sort((a, b) => hitung(b, tampil === 'belum' ? 'belum' : 'perlu') - hitung(a, tampil === 'belum' ? 'belum' : 'perlu') || a.nama.localeCompare(b.nama))

  const nButirPerlu = relevan.reduce((n, s) => n + hitung(s, 'perlu'), 0)
  const nTerverifikasi = relevan.reduce((n, s) => n + hitung(s, 'terverifikasi'), 0)
  const params = { unit: unit ?? undefined, status: tampil === 'perlu' ? undefined : tampil, q: sp.q }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)
  const BATAS = 60

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Verifikasi Riwayat" showBack ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Verifikasi Riwayat' }]} />
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <UjianSubNav />

        <DashTop
          eyebrow="Ujian Tahfidz"
          title="Verifikasi Riwayat Ujian"
          context={<>Anak yang hafalannya sudah melewati ujian yang belum tercatat · {unit ? `Unit ${unit}` : semuaUnit.join(' & ')}</>}
          filters={
            <>
              {semuaUnit.length > 1 && (
                <Slicer label="Unit" options={[
                  { label: 'Semua', href: href({ unit: undefined }), active: !unit },
                  ...semuaUnit.map(u => ({ label: u, href: href({ unit: u }), active: unit === u })),
                ]} />
              )}
              <Slicer label="Tampilkan" options={[
                { label: 'Perlu verifikasi', href: href({ status: undefined }), active: tampil === 'perlu', count: perlu.length },
                { label: 'Belum ujian', href: href({ status: 'belum' }), active: tampil === 'belum', count: belum.length },
                { label: 'Beres', href: href({ status: 'selesai' }), active: tampil === 'selesai', count: selesai.length },
              ]} />
            </>
          }
        />

        {!tabelVerifikasiAda && (
          <p className="rounded-lg border p-3 text-sm" style={{ background: 'var(--warning-wash)', color: 'var(--warning)', borderColor: 'transparent' }}>
            Migrasi <code>0078_verifikasi_riwayat_tahfidz</code> belum dijalankan — daftar tetap tampil, tetapi keputusan belum bisa disimpan.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={<UserSearch className="h-3.5 w-3.5" />} label="Siswa perlu verifikasi" value={perlu.length}
            sub={`dari ${relevan.length.toLocaleString('id-ID')} siswa yang sudah melewati juz 30`} />
          <KpiCard icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Ujian belum diperiksa" value={nButirPerlu}
            sub="juz'iyyah & tasmi'" />
          <KpiCard icon={<CircleX className="h-3.5 w-3.5" />} label="Dinyatakan belum ujian" value={belum.length}
            sub="siswa · perlu diajukan ujian" />
          <KpiCard icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Sudah diverifikasi" value={nTerverifikasi}
            sub="ujian lama dicatat lewat halaman ini" />
        </div>

        <Panel
          title={tampil === 'perlu' ? 'Perlu Verifikasi' : tampil === 'belum' ? 'Dinyatakan Belum Ujian' : 'Sudah Beres'}
          sub={tampil === 'belum'
            ? 'Koordinator menyatakan ujian ini belum dilaksanakan. Ajukan ujiannya seperti biasa.'
            : 'Buka nama siswa untuk melihat daftar juz\'iyyah dan tasmi\' yang semestinya sudah ditempuh.'}
          action={tampil === 'belum' ? { href: '/ujian/ajukan', label: 'Ajukan ujian' } : undefined}
        >
          <form action={PATH} className="mb-4 flex gap-2">
            {unit && <input type="hidden" name="unit" value={unit} />}
            {tampil !== 'perlu' && <input type="hidden" name="status" value={tampil} />}
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Cari nama siswa…"
              className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm" />
          </form>
          {daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {cari ? 'Tidak ada siswa dengan nama itu.' : tampil === 'perlu' ? 'Tidak ada yang perlu diverifikasi. Semua riwayat ujian sudah diperiksa.' : 'Belum ada siswa di kelompok ini.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {daftar.slice(0, BATAS).map((s, i) => <KartuVerifikasi key={s.id} s={s} terbuka={i === 0 && tampil === 'perlu'} />)}
              {daftar.length > BATAS && (
                <p className="text-xs text-muted-foreground">+{daftar.length - BATAS} siswa lainnya — pakai kolom cari untuk menemukannya.</p>
              )}
            </div>
          )}
        </Panel>

        {tampil === 'belum' && belum.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Ujian yang dinyatakan belum: {belum.slice(0, 3).map(s => `${s.nama} (${s.butir.filter(b => b.status === 'belum').map(labelButir).join(', ')})`).join('; ')}
            {belum.length > 3 ? '; …' : ''}. Lihat juga <Link href="/ujian/tasmi" className="text-primary hover:underline">Rekap Tasmi&apos;</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
