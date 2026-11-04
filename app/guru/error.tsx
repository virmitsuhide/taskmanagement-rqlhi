'use client'

import { HalamanGalat } from '@/components/galat/HalamanGalat'

export default function Galat({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <HalamanGalat error={error} reset={reset} beranda="/guru" layarPenuh={false} />
}
