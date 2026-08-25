import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import { getGukarGroup, getGukarMonthly, getGukarParticipants, bolehMengampuGukar } from '@/lib/data/gukar'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { GukarMonthBoard } from '@/components/gukar/GukarMonthBoard'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periode?: string }>
}

export default async function GukarGroupPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const sp = await searchParams
  const period = isValidPeriod(sp.periode ?? '') ? sp.periode! : currentPeriod()

  const group = await getGukarGroup(id)
  if (!group) notFound()

  // Pengampu hanya boleh membuka kelompoknya sendiri. Dicek di sini dan
  // sekali lagi di server action — halaman bisa dilewati lewat URL, action
  // tidak.
  if (group.pengampu_id !== session.teacherId) redirect('/guru/gukar')
  // Halaman daftar yang menjelaskan alasannya.
  if (!(await bolehMengampuGukar(session.teacherId))) redirect('/guru/gukar')

  const [term, participants] = await Promise.all([getCurrentTerm(), getGukarParticipants(id)])
  const monthly = await getGukarMonthly(participants.map(p => p.id), period)

  return (
    <div>
      <TeacherHeader fullName={session.fullName} />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Link
          href="/guru/gukar"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />Kelompok saya
        </Link>

        <h1 className="mt-2 text-2xl font-bold leading-tight">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {participants.length} peserta{group.unit ? ` · ${group.unit}` : ''}
          {term ? ` · ${formatTerm(term)}` : ''}
        </p>

        <GukarMonthBoard
          groupId={id}
          period={period}
          participants={participants}
          monthly={Object.fromEntries(monthly)}
        />
      </div>
    </div>
  )
}
