'use client'

import { useState } from 'react'

interface AgendaItemDraft {
  /** Id baris yang sudah tersimpan — dikirim balik supaya status Papan Rapat tidak hilang saat disunting. */
  id?: string
  tag: string
  discussion: string
  follow_up: string
  /** Approval: yang disetujui memerlukan biaya (diisi bendahara di Papan Rapat). */
  butuh_biaya?: boolean
}

export function useAgendaItems(initial: AgendaItemDraft[] = []) {
  const [items, setItems] = useState<AgendaItemDraft[]>(
    initial.length > 0 ? initial : [{ tag: 'informasi', discussion: '', follow_up: '' }]
  )

  const add = () =>
    setItems(prev => [...prev, { tag: 'informasi', discussion: '', follow_up: '' }])

  const remove = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index))

  const update = <K extends keyof AgendaItemDraft>(index: number, field: K, value: AgendaItemDraft[K]) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))

  return { items, add, remove, update }
}
