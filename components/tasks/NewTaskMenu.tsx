'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, Zap, Target, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NewTaskMenu({ canDelegate }: { canDelegate: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" onClick={() => setOpen(o => !o)}>
        <Plus className="h-4 w-4 mr-1" />Buat Tugas
        <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border bg-popover shadow-lg p-1 text-sm">
          <Link
            href="/tasks/baru?personal=1&priority=normal"
            onClick={() => setOpen(false)}
            className="flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <Zap className="h-4 w-4 mt-0.5 text-blue-600" />
            <div>
              <div className="font-medium">Tugas Pribadi · Jangka Pendek</div>
              <div className="text-[11px] text-muted-foreground">Untuk diri sendiri, deadline dekat</div>
            </div>
          </Link>
          <Link
            href="/tasks/baru?personal=1&priority=jangka_panjang"
            onClick={() => setOpen(false)}
            className="flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <Target className="h-4 w-4 mt-0.5 text-amber-600" />
            <div>
              <div className="font-medium">Tugas Pribadi · Jangka Panjang</div>
              <div className="text-[11px] text-muted-foreground">Target jangka panjang Anda sendiri</div>
            </div>
          </Link>
          {canDelegate && (
            <Link
              href="/tasks/baru"
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 px-3 py-2 rounded-md hover:bg-accent transition-colors border-t mt-1 pt-2.5"
            >
              <UserPlus className="h-4 w-4 mt-0.5 text-emerald-600" />
              <div>
                <div className="font-medium">Delegasikan Tugas</div>
                <div className="text-[11px] text-muted-foreground">Berikan tugas ke bawahan/rekan</div>
              </div>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
