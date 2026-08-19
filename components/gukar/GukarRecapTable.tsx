'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { GukarRecapRow } from '@/lib/data/gukar'

interface Props {
  rows: GukarRecapRow[]
  /** Ambang kehadiran dalam persen, mis. 75. */
  target: number
}

/**
 * Rekap seluruh peserta pembinaan.
 *
 * Penyaringan dikerjakan di peramban, bukan lewat URL: jumlahnya hanya ratusan
 * baris dan SDM lazimnya mengayak bolak-balik antar kelompok — memanggil ulang
 * server tiap ketikan justru terasa lebih lambat.
 */
export function GukarRecapTable({ rows, target }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')

  const groups = useMemo(
    () => [...new Set(rows.map(r => r.groupName))].sort(),
    [rows],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (group && r.groupName !== group) return false
      if (!q) return true
      return r.participant.full_name.toLowerCase().includes(q)
        || r.groupName.toLowerCase().includes(q)
        || r.pengampuName.toLowerCase().includes(q)
    })
  }, [rows, query, group])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari nama, kelompok, atau pengampu…"
          className="h-9 max-w-xs"
        />
        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Semua kelompok</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="self-center text-xs text-muted-foreground">
          {shown.length} dari {rows.length} peserta
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              <th className="py-2 px-3 font-medium">Kelompok</th>
              <th className="py-2 px-3 font-medium">Pengampu</th>
              <th className="py-2 px-3 font-medium">Capaian Tahsin</th>
              <th className="py-2 px-3 font-medium">Capaian Tahfidz</th>
              <th className="py-2 px-2 text-right font-medium">Hadir</th>
              <th className="py-2 px-2 text-right font-medium">%</th>
              <th className="py-2 px-2 text-right font-medium">Hal.</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(row => (
              <tr key={row.participant.id} className="border-b last:border-0">
                <td className="py-2 px-3">
                  <p className="font-medium">{row.participant.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[row.participant.kind, row.participant.unit].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{row.groupName}</td>
                <td className="py-2 px-3 text-muted-foreground">{row.pengampuName}</td>
                <td className="py-2 px-3">{row.capaianTahsin || '—'}</td>
                <td className="py-2 px-3">{row.capaianTahfidz || '—'}</td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {row.slot ? `${row.hadir}/${row.slot}` : '—'}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {row.slot === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={
                        row.percent >= target
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'font-medium text-amber-600 dark:text-amber-400'
                      }
                    >
                      {row.percent}%
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{row.halaman || '—'}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-foreground">
                  Tidak ada peserta yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Persentase dihitung terhadap bulan yang sudah dicatat pengampu, bukan seluruh bulan
        semester — bulan yang belum diisi berarti datanya belum ada, bukan peserta tidak hadir.
      </p>
    </div>
  )
}
