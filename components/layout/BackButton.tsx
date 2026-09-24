'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Kembali</span>
    </button>
  )
}
