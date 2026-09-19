'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tab di dalam satu panel. Isi tiap tab sudah dirender di server dan hanya
 * disembunyikan/ditampilkan di sini — mengganti tab tidak memanggil server,
 * berbeda dari slicer halaman yang memang mengubah data.
 */
export function PanelTabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [aktif, setAktif] = useState(tabs[0]?.key)
  return (
    <div>
      <div role="tablist" className="mb-4 inline-flex gap-0.5 rounded-lg border bg-muted p-0.5">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === aktif}
            onClick={() => setAktif(t.key)}
            className={cn(
              'whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
              t.key === aktif ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.key} role="tabpanel" hidden={t.key !== aktif}>{t.content}</div>
      ))}
    </div>
  )
}
