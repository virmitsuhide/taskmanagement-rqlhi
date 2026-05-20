'use client'

import { useState } from 'react'

interface AgendaItemDraft {
  tag: string
  discussion: string
  follow_up: string
}

export function useAgendaItems(initial: AgendaItemDraft[] = []) {
  const [items, setItems] = useState<AgendaItemDraft[]>(
    initial.length > 0 ? initial : [{ tag: 'informasi', discussion: '', follow_up: '' }]
  )

  const add = () =>
    setItems(prev => [...prev, { tag: 'informasi', discussion: '', follow_up: '' }])

  const remove = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index))

  const update = (index: number, field: keyof AgendaItemDraft, value: string) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))

  return { items, add, remove, update }
}
