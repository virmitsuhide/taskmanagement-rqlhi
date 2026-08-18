'use client'

import { useActionState, useState } from 'react'
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { updateHomeSectionsAction, resetHomeSectionsAction } from '@/app/actions/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HomeSection, HomeSectionKey } from '@/types'
import { FormFeedback } from './FormFeedback'

type FormState = { error?: string; success?: string } | null

/** Penjelasan singkat tiap seksi + apakah punya batas jumlah item. */
const SECTION_META: Record<HomeSectionKey, { hint: string; hasLimit: boolean }> = {
  pengumuman:  { hint: 'Pengumuman & tugas guru di kolom kiri',           hasLimit: true  },
  agenda:      { hint: 'Kalender satu bulan penuh di kolom kanan',        hasLimit: false },
  news:        { hint: 'Carousel berita & artikel dari halaman Berita',   hasLimit: true  },
  program:     { hint: 'Kartu ringkas program RQ',                        hasLimit: true  },
  profil_guru: { hint: 'Cuplikan guru yang ditandai tampil publik',       hasLimit: true  },
}

export function SectionsForm({ sections }: { sections: HomeSection[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateHomeSectionsAction,
    null,
  )
  const [resetState, resetAction, isResetting] = useActionState<FormState, FormData>(
    resetHomeSectionsAction,
    null,
  )

  // Urutan dipegang di state supaya tombol naik/turun bisa menggeser baris tanpa
  // reload. Nilai akhirnya dikirim lewat hidden input `order_<key>`.
  const [order, setOrder] = useState<HomeSection[]>(sections)

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        {order.map((section, i) => {
          const meta = SECTION_META[section.key]
          return (
            <div key={section.key} className="rounded-xl border bg-card p-4">
              <input type="hidden" name={`order_${section.key}`} value={i} />

              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Naikkan ${section.title}`}
                    className="rounded border p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Turunkan ${section.title}`}
                    className="rounded border p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`enabled_${section.key}`}
                      defaultChecked={section.enabled}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm font-medium">Tampilkan seksi ini</span>
                  </label>

                  <p className="text-xs text-muted-foreground -mt-1.5">{meta.hint}</p>

                  <div className={`grid gap-3 ${meta.hasLimit ? 'sm:grid-cols-[1fr_140px]' : ''}`}>
                    <div className="space-y-1.5">
                      <Label htmlFor={`title_${section.key}`} className="text-xs">Judul seksi</Label>
                      <Input
                        id={`title_${section.key}`}
                        name={`title_${section.key}`}
                        defaultValue={section.title}
                        placeholder="Judul yang tampil di beranda"
                      />
                    </div>
                    {meta.hasLimit && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`limit_${section.key}`} className="text-xs">Jumlah item</Label>
                        <Input
                          id={`limit_${section.key}`}
                          name={`limit_${section.key}`}
                          type="number"
                          min={1}
                          max={24}
                          defaultValue={section.limit}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        <FormFeedback state={state} />

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} size="lg">
            {isPending ? 'Menyimpan…' : 'Simpan Tampilan'}
          </Button>
        </div>
      </form>

      <form action={resetAction} className="pt-2 border-t">
        <FormFeedback state={resetState} />
        <Button type="submit" variant="ghost" size="sm" disabled={isResetting} className="text-muted-foreground mt-3">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {isResetting ? 'Mengembalikan…' : 'Kembalikan ke tampilan bawaan'}
        </Button>
      </form>
    </div>
  )
}
