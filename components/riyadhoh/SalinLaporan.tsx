'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Salin teks laporan untuk ditempel ke grup WhatsApp. */
export function SalinLaporan({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = useState(false)
  async function salin() {
    try {
      await navigator.clipboard.writeText(teks)
    } catch {
      // Peramban lama / tanpa izin papan klip: pakai textarea tersembunyi.
      const t = document.createElement('textarea')
      t.value = teks
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setTersalin(true)
    setTimeout(() => setTersalin(false), 2000)
  }
  return (
    <Button onClick={salin} className="w-full sm:w-auto">
      {tersalin ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
      {tersalin ? 'Tersalin' : 'Salin laporan untuk WhatsApp'}
    </Button>
  )
}
