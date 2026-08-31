import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getKpiRapor } from '@/lib/data/kpi-rapor'
import { getBandingRapor } from '@/lib/data/kpi-banding'
import { matangkanJatuhTempo, tandaiRaporDibuka } from '@/lib/data/kpi-pengesahan'
import { ttdSrc } from '@/lib/kpi/ttd-berkas'
import { parseTtdFocus } from '@/lib/kpi/tanda-tangan'
import { terlihatGuru } from '@/lib/kpi/alur'
import { KpiRaporSheet } from '@/components/kpi/KpiRaporSheet'
import { AksiRapor } from './AksiRapor'
import type { Jenjang, KpiRaporStatus } from '@/types'

interface PageProps {
  params: Promise<{ year: string; month: string }>
}

/**
 * Satu lembar rapor KPI, dilihat oleh guru yang bersangkutan.
 *
 * Lembarnya adalah komponen yang sama persis dengan yang dipakai SDM
 * (KpiRaporSheet) — bukan versi ringkas untuk guru. Dokumen yang diserahkan
 * dan dokumen yang diarsipkan harus satu barang; membuat tampilan tersendiri
 * untuk guru melahirkan dua sumber yang cepat atau lambat berselisih, dan yang
 * berselisih tentang dokumen bertanda tangan bukan hal sepele.
 */
export default async function RaporKpiGuruDetail({ params }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { year: y, month: m } = await params
  const year = Number(y)
  const month = Number(m)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound()

  const supabase = createServerClient()

  // Barisnya dicari lewat (guru, periode) tanpa unit: guru tidak tahu — dan
  // tidak perlu tahu — di unit mana ia tercatat pada bulan itu. Unitnya diambil
  // dari barisnya sendiri, sebab itulah rubrik yang dipakai menilainya.
  const { data: baris } = await supabase
    .from('kpi_monthly')
    .select('id, unit, status, guru_ttd_at, banding_batas, versi')
    .eq('teacher_id', session.teacherId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const row = baris as {
    id: string
    unit: Jenjang | null
    status: KpiRaporStatus
    guru_ttd_at: string | null
    banding_batas: string | null
    versi: number
  } | null

  if (!row || !row.unit || !terlihatGuru(row.status)) notFound()

  // Tenggat yang lewat dimatangkan lebih dulu, supaya tombol yang digambar di
  // bawah mencerminkan keadaan hari ini dan bukan keadaan saat rapor terbit.
  const matang = await matangkanJatuhTempo([row])
  const status: KpiRaporStatus = matang.has(row.id) ? 'selesai' : row.status

  const [rapor, banding, profil] = await Promise.all([
    getKpiRapor(session.teacherId, row.unit, year, month),
    getBandingRapor(row.id),
    supabase
      .from('teachers')
      .select('signature_path, signature_focus')
      .eq('id', session.teacherId)
      .maybeSingle(),
  ])

  if (!rapor) notFound()

  // Dicatat setelah halamannya dipastikan bisa dirender: penanda "sudah
  // dibuka" yang tercatat pada percobaan yang gagal akan memadamkan lencana
  // untuk rapor yang sebenarnya belum pernah terlihat.
  await tandaiRaporDibuka(row.id)

  const p = (profil as { data: { signature_path: string | null; signature_focus: unknown } | null }).data
  const ttdSaya = await ttdSrc(p?.signature_path)

  return (
    <div className="mx-auto max-w-[880px] p-4 md:p-6">
      <Link
        href="/guru/rapor-kpi"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" />Kembali ke daftar rapor
      </Link>

      <KpiRaporSheet rapor={rapor} terbit={new Date()} />

      <div className="print:hidden">
        <AksiRapor
          kpiId={row.id}
          status={status}
          versi={row.versi}
          sudahTtd={Boolean(row.guru_ttd_at)}
          bandingBatas={row.banding_batas}
          selesaiSebab={rapor.pengesahan.selesaiSebab}
          baris={rapor.baris.map((b, i) => ({
            indikator: i, nama: b.nama, nilai: b.nilai, capaian: b.capaian, target: b.target,
          }))}
          banding={banding}
          ttdSaya={ttdSaya}
          ttdFokus={parseTtdFocus(p?.signature_focus)}
        />
      </div>
    </div>
  )
}
