'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, MessageCircle, Printer } from 'lucide-react'

interface Props {
  studentName: string
  waliName: string | null
  waliPhone: string | null
  monthLabel: string
  summary: string         // ringkasan singkat untuk pesan WA
  raporUrl: string        // URL publik tokenized (absolute)
}

function waPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '').replace(/^0/, '62')
  return digits || null
}

export function RaporShareButton({ studentName, waliName, waliPhone, monthLabel, summary, raporUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const greeting = waliName ? `Assalamu'alaikum Bapak/Ibu ${waliName},` : `Assalamu'alaikum Bapak/Ibu,`
  const message =
    `${greeting}\n\n` +
    `Berikut rapor tahsin & tahfidz Ananda *${studentName}* bulan ${monthLabel} di RQ LHI. 🌙\n\n` +
    `${summary}\n\n` +
    `Rapor lengkap: ${raporUrl}\n\n` +
    `Mohon dukungan muroja'ah di rumah. Jazakumullahu khairan.`

  const phone = waPhone(waliPhone)
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(raporUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild style={{ background: '#25d366', borderColor: '#25d366', color: 'white' }}>
        <a href={waUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 mr-1.5" />
          {phone ? 'Kirim ke Wali (WA)' : 'Bagikan via WA'}
        </a>
      </Button>
      <Button variant="outline" onClick={copyLink}>
        {copied ? <><Check className="h-4 w-4 mr-1.5" />Tersalin</> : <><Copy className="h-4 w-4 mr-1.5" />Salin Link</>}
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-1.5" />Cetak / PDF
      </Button>
    </div>
  )
}
