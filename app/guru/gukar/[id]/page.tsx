import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import {
  getGukarGroup, getGukarMonthly, getGukarParticipants, bolehMengampuGukar,
  getMetodeGukar, getTahapanGukar, getPosisiSebelumnya, getDaftarSurat,
} from '@/lib/data/gukar'
import { GukarMonthBoard } from '@/components/gukar/GukarMonthBoard'
import { isValidPeriod } from '@/lib/finance/period'
import { hariIni } from '@/lib/rutin/periode'
import { statusSetoranBulan } from '@/lib/rq/gukar-siklus'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periode?: string }>
}

export default async function GukarGroupPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const sp = await searchParams
  // Bulan bawaan menurut kalender WIB, bukan jam server — lihat hariIni().
  const period = isValidPeriod(sp.periode ?? '') ? sp.periode! : hariIni().slice(0, 7)

  const group = await getGukarGroup(id)
  if (!group) notFound()

  // Pengampu hanya boleh membuka kelompoknya sendiri. Dicek di sini dan
  // sekali lagi di server action — halaman bisa dilewati lewat URL, action
  // tidak.
  if (group.pengampu_id !== session.teacherId) redirect('/guru/gukar')
  // Halaman daftar yang menjelaskan alasannya.
  if (!(await bolehMengampuGukar(session.teacherId))) redirect('/guru/gukar')

  const [term, participants, metode, tahapan] = await Promise.all([
    getCurrentTerm(),
    getGukarParticipants(id),
    getMetodeGukar(),
    getTahapanGukar(),
  ])
  const ids = participants.map(p => p.id)
  // Posisi bulan sebelumnya ikut diambil: formulir memakainya untuk mengunci
  // pilihan surat dan untuk menghitung jarak yang ditempuh bulan ini.
  const [monthly, sebelumnya, surat] = await Promise.all([
    getGukarMonthly(ids, period),
    getPosisiSebelumnya(ids, period),
    getDaftarSurat(),
  ])
  const hari = hariIni()
  // Kunci dibaca per kelompok: satu baris yang terkunci berarti bulan itu terkunci.
  const dikunciAt = [...monthly.values()].find(r => r.dikunci_at)?.dikunci_at ?? null

  return (
    <div>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <Link
          href="/guru/gukar"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />Kelompok saya
        </Link>

        <h1 className="mt-2 text-3xl leading-tight">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {participants.length} peserta{group.unit ? ` · ${group.unit}` : ''}
          {term ? ` · ${formatTerm(term)}` : ''}
        </p>

        <GukarMonthBoard
          groupId={id}
          period={period}
          hariIni={hari}
          status={statusSetoranBulan(period, hari, dikunciAt)}
          participants={participants}
          monthly={Object.fromEntries(monthly)}
          metode={metode}
          tahapan={tahapan}
          sebelumnya={sebelumnya}
          surat={surat}
        />
      </div>
    </div>
  )
}
