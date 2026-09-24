'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { simpanAsalSdLhiAction } from '@/app/actions/target-tahfidz'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SiswaAsal {
  id: string
  nama: string
  kelas: string | null
  halaqoh: string | null
  asalSdLhi: boolean
}

/**
 * Centang siswa SMP yang lulusan SD LHI.
 *
 * Semua siswa dikirim bersama status centangnya, bukan hanya yang terlihat di
 * tab kelas yang sedang dibuka — berpindah tab lalu menyimpan tidak boleh
 * melepas tanda siswa di kelas lain.
 */
export function AsalSdLhiForm({ siswa }: { siswa: SiswaAsal[] }) {
  const [state, action, pending] = useActionState(simpanAsalSdLhiAction, null)
  const [internal, setInternal] = useState(() => new Set(siswa.filter(s => s.asalSdLhi).map(s => s.id)))
  const kelasList = useMemo(() => [...new Set(siswa.map(s => s.kelas ?? 'Tanpa kelas'))].sort(), [siswa])
  const [kelas, setKelas] = useState(kelasList[0] ?? '')

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    else if (state?.success) toast.success('Asal siswa disimpan — target SMPIT ikut menyesuaikan.')
  }, [state])

  const tampil = siswa.filter(s => (s.kelas ?? 'Tanpa kelas') === kelas)
  const semuaTercentang = tampil.length > 0 && tampil.every(s => internal.has(s.id))

  const ubah = (ids: string[], nilai: boolean) =>
    setInternal(prev => {
      const next = new Set(prev)
      ids.forEach(id => (nilai ? next.add(id) : next.delete(id)))
      return next
    })

  return (
    <form action={action} className="rounded-2xl border bg-card p-5">
      {siswa.map(s => (
        <span key={s.id}>
          <input type="hidden" name="siswa" value={s.id} />
          {internal.has(s.id) && <input type="hidden" name="internal" value={s.id} />}
        </span>
      ))}

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {kelasList.map(k => {
          const jumlah = siswa.filter(s => (s.kelas ?? 'Tanpa kelas') === k && internal.has(s.id)).length
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKelas(k)}
              aria-pressed={k === kelas}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                k === kelas ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border',
              )}
            >
              {k} <span className="opacity-70">· {jumlah}</span>
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 border-b pb-2 mb-1 text-xs font-medium">
        <input type="checkbox" checked={semuaTercentang} onChange={e => ubah(tampil.map(s => s.id), e.target.checked)} className="h-4 w-4" />
        Tandai semua di kelas {kelas}
      </label>
      <ul className="divide-y">
        {tampil.map(s => (
          <li key={s.id}>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <input type="checkbox" checked={internal.has(s.id)} onChange={e => ubah([s.id], e.target.checked)} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{s.nama}</span>
                <span className="block text-[11px] text-muted-foreground">{s.halaqoh ?? 'Tanpa halaqoh'}</span>
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">{internal.has(s.id) ? 'Internal' : 'Eksternal'}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground tabular-nums">{internal.size} dari {siswa.length} siswa ditandai internal</p>
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
      </div>
    </form>
  )
}
