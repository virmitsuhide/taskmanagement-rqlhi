'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { groupSiswaByLevel } from '@/lib/rq/ujian'
import type { UjianTahsin } from '@/types'

/** Nama yang tampil sebelum daftar dilipat jadi "+n lainnya". */
const BATAS_NAMA = 8

/**
 * Nama anak dalam satu pengajuan ujian tahsin, dikelompokkan per level.
 *
 * Pengajuan tahsin disimpan per kelompok (judulnya nama ustadz/ah), jadi
 * tanpa daftar ini kartunya hanya berbunyi "Ustadzah X · 6 siswa" — guru tidak
 * bisa memastikan anak mana yang sudah ia ajukan, dan koordinator tidak bisa
 * melihat siapa yang menunggu tanpa membuka dialog kelola.
 *
 * Tiap nama satu "chip" supaya nama dua-tiga kata tidak terpotong di tengah
 * baris pada kolom papan yang sempit. Kelompok besar dilipat setelah
 * BATAS_NAMA nama. Predikat diberi warna begitu ujiannya dinilai; sebelum itu
 * nama tampil polos, sebab "Belum" di setiap nama hanya menambah bising.
 */
export function AnggotaTahsin({ item, className }: { item: UjianTahsin; className?: string }) {
  const [semua, setSemua] = useState(false)
  const grup = groupSiswaByLevel(item)
  if (grup.length === 0) return null
  const dinilai = item.status === 'selesai'
  const total = grup.reduce((n, g) => n + g.siswa.length, 0)

  // Jatah nama dibagi berurutan per level: level pertama dihabiskan dulu.
  // Dihitung dari jumlah level sebelumnya, bukan variabel berjalan (render murni).
  const jatah = (i: number) => (semua ? Infinity : Math.max(0, BATAS_NAMA - grup.slice(0, i).reduce((n, g) => n + g.siswa.length, 0)))

  return (
    <div className={cn('space-y-2 text-xs', className)}>
      {grup.map((g, gi) => {
        const tampil = g.siswa.slice(0, jatah(gi))
        if (tampil.length === 0) return null
        return (
          <div key={g.level}>
            {grup.length > 1 && (
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {g.level} <span className="tabular-nums">· {g.siswa.length}</span>
              </p>
            )}
            <ul className="flex flex-wrap gap-1">
              {tampil.map((s, i) => (
                <li
                  key={`${s.student_id ?? s.nama}-${i}`}
                  className={cn(
                    'rounded-md bg-muted px-1.5 py-0.5 leading-snug',
                    dinilai && s.predikat === 'lulus' && 'bg-success/10 text-success',
                    dinilai && s.predikat === 'mengulang' && 'bg-destructive/10 text-destructive',
                  )}
                >
                  {s.nama}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {total > BATAS_NAMA && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setSemua(v => !v) }}
          className="font-medium text-primary hover:underline"
        >
          {semua ? 'Ringkas' : `+${total - BATAS_NAMA} siswa lainnya`}
        </button>
      )}
    </div>
  )
}
