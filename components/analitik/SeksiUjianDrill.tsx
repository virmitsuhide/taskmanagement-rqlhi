import { drillTahfidzUnit, drillTahsinSemua, ujianSemua } from '@/lib/data/analitik-cache'
import { HafalanUjianBoard } from '@/components/dashboard/HafalanUjianBoard'
import { DrillTahsinBoard } from '@/components/dashboard/DrillTahsinBoard'
import { DrillTahfidzBoard } from '@/components/dashboard/DrillTahfidzBoard'
import { Seksi, Kunci, type InfoSeksi } from './seksi'
import type { Jenjang } from '@/types'

/**
 * Seksi 4 — anak yang menunggu ujian (drill tahsin & tahfidz), dan hasil
 * ujian hafalan yang sudah lulus.
 *
 * Daftar "Terbanyak" di papan ujian dimatikan di sini: peringkat hafalan
 * sudah tampil sebagai 10 Besar di seksi Ringkasan, dan sumbernya (setoran
 * atau ujian, yang terjauh) mencakup angka ujian ini.
 */
export async function SeksiUjianDrill({ info, jenjang, fokus }: {
  info: InfoSeksi
  jenjang: Jenjang | null
  fokus: 'semua' | 'tahsin' | 'tahfidz'
}) {
  const [semuaUjian, semuaDrill, drillTahfidz] = await Promise.all([
    ujianSemua(), drillTahsinSemua(), drillTahfidzUnit(jenjang ?? 'semua'),
  ])
  const ujian = semuaUjian.filter(u => !jenjang || u.jenjang === jenjang)
  const drill = semuaDrill.filter(u => !jenjang || u.jenjang === jenjang)

  const drillBelum = drill.reduce((n, u) => n + u.belumDiajukan, 0)
  const drillTotal = drill.reduce((n, u) => n + u.siswa.length, 0)
  const juzTeruji = ujian.reduce((n, u) => n + u.totalJuz, 0)
  const tahsin = fokus !== 'tahfidz'
  const tahfidz = fokus !== 'tahsin'

  return (
    <Seksi
      info={info}
      judul="Ujian & Drill"
      pertanyaan="Siapa yang menunggu ujian, dan berapa juz yang sudah diakui lulus?"
      catatan="kondisi hari ini"
      kunci={
        <>
          {tahsin && <Kunci label="Drill tahsin" nilai={drillTotal.toLocaleString('id-ID')} />}
          {tahsin && <Kunci label="Belum diajukan" nilai={drillBelum.toLocaleString('id-ID')} nada={drillBelum > 0 ? 'bahaya' : 'baik'} />}
          {tahfidz && <Kunci label="Juz menunggu ujian" nilai={drillTahfidz.sedang.length.toLocaleString('id-ID')} nada={drillTahfidz.sedang.length > 0 ? 'waspada' : 'baik'} />}
          {tahfidz && <Kunci label="Juz teruji" nilai={juzTeruji.toLocaleString('id-ID')} />}
        </>
      }
    >
      {/* Z: yang menunggu tindakan (drill) lebih dulu, capaian ujian menyusul. */}
      {tahsin && <div id="drill-tahsin" className="scroll-mt-[140px]"><DrillTahsinBoard units={drill} /></div>}
      {tahfidz && <div id="drill-tahfidz" className="scroll-mt-[140px]"><DrillTahfidzBoard data={drillTahfidz} showUnit={!jenjang} /></div>}
      {tahfidz && <HafalanUjianBoard units={ujian} tampilTeratas={false} />}
    </Seksi>
  )
}
