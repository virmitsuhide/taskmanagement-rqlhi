import { ImageResponse } from 'next/og'
import { verifyRaporToken } from '@/lib/rapor-token'
import { getStudentRaporData } from '@/lib/data/rapor'

export const alt = 'Rapor Tahsin & Tahfidz — RQ LHI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ token: string }>
}

export default async function Image({ params }: Props) {
  const { token } = await params
  const payload = await verifyRaporToken(token)
  const data = payload ? await getStudentRaporData(payload.sid, payload.y, payload.m) : null

  const name = data?.student.full_name ?? 'Rapor Siswa'
  const monthLabel = data?.period.monthLabel ?? ''
  const tahsinText = data?.tahsin.currentJilid
    ? `${data.tahsin.currentMethod ?? ''} ${data.tahsin.currentJilid}`
    : 'Tahsin'
  const tahfidzText = data?.tahfidz.currentJuz
    ? `Juz ${data.tahfidz.currentJuz} (${data.tahfidz.currentJuzPercent}%)`
    : 'Tahfidz'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #b8860b 0%, #8a6308 100%)',
          color: 'white',
          padding: 64,
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800,
            }}
          >
            RQ
          </div>
          <div style={{ fontSize: 22, opacity: 0.9, letterSpacing: 2 }}>RUMAH QUR&apos;AN LHI</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 24, opacity: 0.85, marginBottom: 8 }}>
            Rapor Tahsin &amp; Tahfidz · {monthLabel}
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
        </div>

        <div style={{ display: 'flex', gap: 40, fontSize: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ opacity: 0.8 }}>📖</span> {tahsinText}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ opacity: 0.8 }}>✨</span> {tahfidzText}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
