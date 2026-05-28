import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { verifyRaporToken } from '@/lib/rapor-token'
import { getStudentRaporData } from '@/lib/data/rapor'
import { RaporDocument } from '@/components/rapor/RaporDocument'
import { Lora, Playfair_Display } from 'next/font/google'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const payload = await verifyRaporToken(token)
  if (!payload) return { title: 'Rapor tidak ditemukan' }

  const data = await getStudentRaporData(payload.sid, payload.y, payload.m)
  if (!data) return { title: 'Rapor tidak ditemukan' }

  const title = `Rapor ${data.student.full_name} — ${data.period.monthLabel}`
  const description = data.tahfidz.currentJuz
    ? `Tahsin ${data.tahsin.currentJilid ?? '-'} · Tahfidz Juz ${data.tahfidz.currentJuz} (${data.tahfidz.currentJuzPercent}%) · RQ LHI`
    : `Rapor tahsin & tahfidz di Rumah Qur'an LHI`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    robots: { index: false, follow: false }, // jangan di-index search engine
  }
}

export default async function PublicRaporPage({ params }: PageProps) {
  const { token } = await params
  const payload = await verifyRaporToken(token)
  if (!payload) notFound()

  const data = await getStudentRaporData(payload.sid, payload.y, payload.m)
  if (!data) notFound()

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen py-8 px-4`}
      style={{ background: '#fafaf7', fontFamily: 'var(--font-lora), Georgia, serif' }}
    >
      <div className="max-w-3xl mx-auto">
        <RaporDocument data={data} />
        <p className="text-center text-xs text-muted-foreground mt-6 print:hidden">
          Rapor digital Rumah Qur&apos;an LHI · Dibagikan oleh wali halaqoh.
        </p>
      </div>
    </div>
  )
}
