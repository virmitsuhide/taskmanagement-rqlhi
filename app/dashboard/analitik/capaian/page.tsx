import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang } from '@/lib/auth/permissions'
import { getCapaianKelas, BELUM_TERCATAT, type CapaianKelompok, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { UNIT_LABELS } from '@/lib/rq/programs'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, GroupLabel, Slicer, KpiCard, hrefDengan } from '@/components/dashboard/kit'
import { CapaianKelompokPanel, PerbandinganJalur } from '@/components/dashboard/CapaianKelompok'
import { BookOpen, BookMarked, Users, HelpCircle } from 'lucide-react'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; jalur?: string }>
}

const PATH = '/dashboard/analitik/capaian'

/**
 * Capaian tahsin & tahfidz per kelas, per unit — reguler (CLIL/non-QULS) dan
 * QULS berdampingan.
 *
 * Padanan realtime bab 02 Laporan Eksekutif: tabelnya berbentuk sama
 * (kelas × jilid, kelas × juz) sehingga bisa langsung dipindah ke laporan,
 * tapi angkanya dari setoran terakhir tiap siswa SAAT HALAMAN DIBUKA.
 * Satu unit per tampilan: tiap angka membawa daftar siswanya untuk dialog
 * rincian, dan seluruh unit sekaligus terlalu berat untuk dikirim.
 */
export default async function CapaianKelasPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const data = await getCapaianKelas(getAnalyticsJenjang(session.role))

  const unitAda = [...new Set(data.kelompok.map(k => k.jenjang))]
  const unit: Jenjang | undefined = unitAda.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : unitAda[0]
  const diUnit = data.kelompok.filter(k => k.jenjang === unit)
  const jalur = sp.jalur === 'reguler' || sp.jalur === 'quls' ? sp.jalur : null
  const tampil = jalur ? diUnit.filter(k => k.jalur === jalur) : diUnit
  const reguler = diUnit.find(k => k.jalur === 'reguler')
  const quls = diUnit.find(k => k.jalur === 'quls')

  const siswa = tampil.reduce((n, k) => n + k.siswa, 0)
  const jumlah = (pilih: (k: CapaianKelompok) => MatriksCapaian[], f: (m: MatriksCapaian) => number) =>
    tampil.reduce((n, k) => n + pilih(k).reduce((a, m) => a + f(m), 0), 0)
  const tahsin = (k: CapaianKelompok) => [k.tahsin]
  const tahfidz = (k: CapaianKelompok) => k.tahfidz
  const capaiTahsin = jumlah(tahsin, m => m.maju)
  const targetTahsin = jumlah(tahsin, m => m.bertarget ?? 0)
  const capaiTahfidz = jumlah(tahfidz, m => m.maju)
  const targetTahfidz = jumlah(tahfidz, m => m.bertarget ?? 0)
  const belumTahsin = jumlah(tahsin, belumSetor)
  const belumTahfidz = jumlah(tahfidz, belumSetor)

  const pukul = new Date(data.diambil).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const namaJalur = (k: CapaianKelompok) => k.judul.split(' — ')[1] ?? 'Semua'

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Capaian per Kelas" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Kurikulum & Pembelajaran Al-Qur'an"
          title="Capaian Tahsin & Tahfidz per Kelas"
          context={<>Dari setoran terakhir per {pukul} WIB · dihitung ulang setiap halaman dibuka</>}
          filters={unitAda.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {unitAda.length > 1 && (
                <Slicer
                  label="Unit"
                  options={unitAda.map(u => ({
                    label: UNIT_LABELS[u],
                    href: hrefDengan(PATH, {}, { unit: u }),
                    active: unit === u,
                    count: data.kelompok.filter(k => k.jenjang === u).reduce((n, k) => n + k.siswa, 0),
                  }))}
                />
              )}
              {diUnit.length > 1 && (
                <Slicer
                  label="Program"
                  options={[
                    { label: 'Semua', href: hrefDengan(PATH, { unit }, {}), active: !jalur },
                    ...diUnit.map(k => ({
                      label: namaJalur(k),
                      href: hrefDengan(PATH, { unit }, { jalur: k.jalur }),
                      active: jalur === k.jalur,
                      count: k.siswa,
                    })),
                  ]}
                />
              )}
            </div>
          ) : null}
        />

        {data.kelompok.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground bg-muted/30">
            Belum ada siswa aktif di unit dalam lingkup Anda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Siswa terpantau" value={siswa}
                sub={tampil.map(k => `${namaJalur(k)} ${k.siswa}`).join(' · ')} />
              <KpiCard icon={<BookOpen className="h-3.5 w-3.5" />} label="Capai target tahsin" value={capaiTahsin}
                unit={targetTahsin > 0 ? `/ ${targetTahsin.toLocaleString('id-ID')}` : undefined}
                ratio={targetTahsin > 0 ? capaiTahsin / targetTahsin : undefined}
                sub={targetTahsin > 0 ? 'Siswa yang kelasnya punya target jilid' : 'Target jilid kelas belum diatur'} />
              <KpiCard icon={<BookMarked className="h-3.5 w-3.5" />} label="Capai target tahfidz" value={capaiTahfidz}
                unit={targetTahfidz > 0 ? `/ ${targetTahfidz.toLocaleString('id-ID')}` : undefined}
                ratio={targetTahfidz > 0 ? capaiTahfidz / targetTahfidz : undefined}
                sub="Sesuai atau di atas target tahfidz" />
              <KpiCard icon={<HelpCircle className="h-3.5 w-3.5" />} label="Belum ada setoran"
                value={`${belumTahsin} · ${belumTahfidz}`}
                sub="tahsin · tahfidz — perlu ditagih ke guru" />
            </div>

            {!jalur && reguler && quls && <PerbandinganJalur reguler={reguler} quls={quls} />}

            {tampil.map(k => (
              <div key={k.kode} className="space-y-4">
                <GroupLabel note={`${k.keterangan} · ${k.siswa.toLocaleString('id-ID')} siswa${k.metode.length ? ` · metode ${k.metode.join(', ')}` : ''}`}>
                  {k.judul}
                </GroupLabel>
                <CapaianKelompokPanel k={k} />
              </div>
            ))}

            <p className="text-[11px] text-muted-foreground">
              Urutan hafalan RQ: Juz 30 → 26, lalu Juz 1 dan seterusnya. &ldquo;3 juz&rdquo; / &ldquo;5 juz&rdquo; = sudah menuntaskan
              tiga / lima juz bloknya (lewat kenaikan juz atau ujian) dan belum mulai menyetor juz berikutnya.
              Kolom &ldquo;Belum&rdquo; = siswa aktif yang belum pernah setor di aplikasi — bukan dianggap Jilid 1 atau Juz 30.
              {canViewAnalytics(session.role) && <> <Link href="/dashboard/analitik" className="text-primary hover:underline">← Analitik RQ</Link></>}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function belumSetor(m: MatriksCapaian): number {
  const i = m.kolom.indexOf(BELUM_TERCATAT)
  return i === -1 ? 0 : m.jumlahKolom[i]
}
