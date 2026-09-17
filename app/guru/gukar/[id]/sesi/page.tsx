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
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        <Link
          href={`/guru/gukar/${id}?periode=${period}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />Papan bulanan
        </Link>

        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">
            Setor per Sesi · {formatPeriod(period)}
          </p>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            {group.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Siklus berjalan: {labelSiklus(siklusDari(hari))}
          </p>
        </div>

        {participants.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
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
      </div>
    </div>
  )
}
