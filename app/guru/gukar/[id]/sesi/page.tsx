import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  getGukarGroup, getGukarMonthly, getGukarParticipants, bolehMengampuGukar,
  getMetodeGukar, getTahapanGukar, getPosisiSebelumnya, getDaftarSurat,
} from '@/lib/data/gukar'
import { hariIni } from '@/lib/rutin/periode'
import { formatPeriod } from '@/lib/finance/period'
import { labelSiklus, siklusDari, statusSetoranBulan } from '@/lib/rq/gukar-siklus'
import { SetoranSesiGukar } from '@/components/gukar/SetoranSesiGukar'
import { HalamanGuru } from '@/components/guru/HalamanGuru'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Setor per sesi untuk satu kelompok pembinaan — semua peserta dalam satu
 * layar, seperti setor sesi tahsin/tahfidz santri.
 *
 * Hanya bulan berjalan. Bulan yang sudah lewat terkunci otomatis, jadi tidak
 * ada gunanya menawarkan tanggal di sana; ralat bulan lampau lewat papan
 * bulanan oleh SDM.
 */
export default async function SetorSesiGukarPage({ params }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const group = await getGukarGroup(id)
  if (!group) notFound()
  if (group.pengampu_id !== session.teacherId) redirect('/guru/gukar')
  if (!(await bolehMengampuGukar(session.teacherId))) redirect('/guru/gukar')

  const hari = hariIni()
  const period = hari.slice(0, 7)

  const [participants, metode, tahapan, surat] = await Promise.all([
    getGukarParticipants(id),
    getMetodeGukar(),
    getTahapanGukar(),
    getDaftarSurat(),
  ])
  const ids = participants.map(p => p.id)
  const [monthly, sebelumnya] = await Promise.all([
    getGukarMonthly(ids, period),
    getPosisiSebelumnya(ids, period),
  ])

  const bulanIni = Object.fromEntries(monthly)
  const dikunciAt = Object.values(bulanIni).find(r => r.dikunci_at)?.dikunci_at ?? null
  const status = statusSetoranBulan(period, hari, dikunciAt)

  return (
    <HalamanGuru
      judul={group.name}
      keterangan={`Setor per sesi · ${formatPeriod(period)} · siklus berjalan: ${labelSiklus(siklusDari(hari))}`}
      atas={
        <Link
          href={`/guru/gukar/${id}?periode=${period}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />Papan bulanan
        </Link>
      }
    >

        {participants.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground bg-muted/30">
            Belum ada peserta di kelompok ini.
          </div>
        ) : (
          <SetoranSesiGukar
            groupId={id}
            hariIni={hari}
            status={status}
            participants={participants}
            bulanIni={bulanIni}
            sebelumnya={sebelumnya}
            metode={metode}
            tahapan={tahapan}
            surat={surat}
          />
        )}
    </HalamanGuru>
  )
}
