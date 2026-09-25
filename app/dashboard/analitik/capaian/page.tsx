import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang } from '@/lib/auth/permissions'
import { getCapaianKelas, BELUM_TERCATAT, type CapaianKelompok, type KodeKelompok, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, Panel, GroupLabel, Slicer, KpiCard, hrefDengan } from '@/components/dashboard/kit'
import { MatriksCapaianTable } from '@/components/dashboard/MatriksCapaianTable'
import { BookOpen, BookMarked, Users, HelpCircle } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ kelompok?: string }>
}

const PATH = '/dashboard/analitik/capaian'

/**
 * Capaian tahsin & tahfidz per kelas — CLIL, QULS (SDIT) dan SMP.
 *
 * Padanan realtime bab 02 Laporan Eksekutif: tabelnya berbentuk sama
 * (kelas × jilid, kelas × juz) sehingga bisa langsung dipindah ke laporan,
 * tapi angkanya posisi siswa SAAT HALAMAN DIBUKA, bukan rekap akhir bulan.
 * Program Ekstra sengaja tidak dimasukkan dulu.
 */
export default async function CapaianKelasPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const data = await getCapaianKelas(getAnalyticsJenjang(session.role))

  const kodeAda = data.kelompok.map(k => k.kode)
  const pilihan = kodeAda.includes(sp.kelompok as KodeKelompok) ? (sp.kelompok as KodeKelompok) : null
  const tampil = pilihan ? data.kelompok.filter(k => k.kode === pilihan) : data.kelompok
  const href = (kelompok?: string) => hrefDengan(PATH, {}, { kelompok })

  const jumlah = (f: (m: MatriksCapaian) => number, pilih: (k: CapaianKelompok) => MatriksCapaian) =>
    tampil.reduce((n, k) => n + f(pilih(k)), 0)
  const siswa = tampil.reduce((n, k) => n + k.siswa, 0)
  const belumTahsin = jumlah(belumTercatat, k => k.tahsin)
  const belumTahfidz = jumlah(belumTercatat, k => k.tahfidz)
  const quran = jumlah(m => m.maju, k => k.tahsin)
  const lewat30 = jumlah(m => m.maju, k => k.tahfidz)

  const pukul = new Date(data.diambil).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Capaian per Kelas" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Kurikulum & Pembelajaran Al-Qur'an"
          title="Capaian Tahsin & Tahfidz per Kelas"
          context={<>Posisi siswa per {pukul} WIB · dihitung ulang setiap halaman dibuka</>}
          filters={data.kelompok.length > 1 ? (
            <Slicer
              label="Program"
              options={[
                { label: 'Semua', href: href(), active: !pilihan },
                ...data.kelompok.map(k => ({
                  label: k.kode === 'smp' ? 'SMP' : k.kode.toUpperCase(),
                  href: href(k.kode), active: pilihan === k.kode, count: k.siswa,
                })),
              ]}
            />
          ) : null}
        />

        {data.kelompok.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground bg-muted/30">
            Lingkup Anda tidak mencakup SDIT maupun SMPIT.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Siswa terpantau" value={siswa}
                sub={tampil.map(k => `${k.kode === 'smp' ? 'SMP' : k.kode.toUpperCase()} ${k.siswa}`).join(' · ')} />
              <KpiCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Tahsin sudah Al-Qur'an" value={quran}
                unit={siswa - belumTahsin > 0 ? `/ ${(siswa - belumTahsin).toLocaleString('id-ID')}` : undefined}
                ratio={siswa - belumTahsin > 0 ? quran / (siswa - belumTahsin) : undefined}
                sub="Al-Qur'an, Gharib, Tajwid, atau lulus" />
              <KpiCard icon={<BookMarked className="h-3.5 w-3.5" />} label="Hafalan lewat Juz 30" value={lewat30}
                unit={siswa - belumTahfidz > 0 ? `/ ${(siswa - belumTahfidz).toLocaleString('id-ID')}` : undefined}
                ratio={siswa - belumTahfidz > 0 ? lewat30 / (siswa - belumTahfidz) : undefined}
                sub="Sedang menghafal Juz 29 ke atas" />
              <KpiCard icon={<HelpCircle className="h-3.5 w-3.5" />} label="Posisi belum tercatat"
                value={`${belumTahsin} · ${belumTahfidz}`}
                sub="tahsin · tahfidz — perlu ditagih ke guru" />
            </div>

            {data.sdTanpaProgram > 0 && (!pilihan || pilihan !== 'smp') && (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                {data.sdTanpaProgram.toLocaleString('id-ID')} siswa SDIT belum ditandai programnya, jadi tidak masuk CLIL maupun QULS.
                Tandai di <Link href="/siswa" className="text-primary hover:underline">data siswa</Link>.
              </p>
            )}

            {tampil.map(k => (
              <div key={k.kode} className="space-y-4">
                <GroupLabel note={`${k.keterangan} · ${k.siswa.toLocaleString('id-ID')} siswa${k.metode.length ? ` · metode ${k.metode.join(', ')}` : ''}`}>
                  {k.judul}
                </GroupLabel>
                {/* Ditumpuk, bukan berdampingan: tabel tahsin sampai 13 kolom,
                    dan setengah lebar layar membuatnya harus digeser. */}
                <div className="space-y-5">
                  <Panel title="Capaian Tahsin" icon={<BookOpen className="h-4 w-4" />}
                    sub="Jilid/tahap yang sedang dijalani tiap siswa">
                    <MatriksCapaianTable matriks={k.tahsin} kosong={pesanKosong(k)} />
                  </Panel>
                  <Panel title="Capaian Tahfidz" icon={<BookMarked className="h-4 w-4" />}
                    sub="Juz yang sedang dihafal — dari setoran & ujian, mana yang terjauh">
                    <MatriksCapaianTable matriks={k.tahfidz} kosong={pesanKosong(k)} />
                  </Panel>
                </div>
              </div>
            ))}

            <p className="text-[11px] text-muted-foreground">
              Urutan hafalan RQ: Juz 30 → 26, lalu Juz 1 dan seterusnya. Kolom &ldquo;Belum&rdquo; = siswa aktif yang belum punya
              posisi jilid / belum pernah setor hafalan — bukan dianggap Jilid 1 atau Juz 30.
              {canViewAnalytics(session.role) && <> <Link href="/dashboard/analitik" className="text-primary hover:underline">← Analitik RQ</Link></>}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function belumTercatat(m: MatriksCapaian): number {
  const i = m.kolom.indexOf(BELUM_TERCATAT)
  return i === -1 ? 0 : m.jumlahKolom[i]
}

function pesanKosong(k: CapaianKelompok): string {
  return k.kode === 'quls'
    ? 'Belum ada siswa SDIT yang ditandai program QULS. Tandai programnya di data siswa agar kelas QULS muncul di sini.'
    : `Belum ada siswa aktif di ${k.judul}.`
}
