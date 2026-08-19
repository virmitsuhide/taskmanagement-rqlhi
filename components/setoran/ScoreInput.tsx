'use client'

import { useState } from 'react'

interface Props {
  name: string
  defaultValue?: number | null
  /** Nilai yang paling sering dipakai, tampil sebagai tombol cepat. */
  presets?: number[]
}

/**
 * Input nilai 0–100 untuk setoran.
 *
 * Menggantikan penilaian bintang 0,5–5 yang dipakai rubrik lama. Database
 * Quran SD menunjukkan guru menilai dengan angka bulat — 85, 88, 90, 95 —
 * dan bintang setengah tidak punya padanan untuk itu.
 *
 * Tombol cepat disediakan karena hampir seluruh nilai jatuh di segelintir
 * angka itu; kolom angkanya tetap ada untuk nilai di luar kebiasaan.
 */
export function ScoreInput({ name, defaultValue = null, presets = [80, 85, 88, 90, 95, 100] }: Props) {
  const [value, setValue] = useState<string>(defaultValue == null ? '' : String(defaultValue))

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {presets.map(preset => {
          const active = value === String(preset)
          return (
            <button
              key={preset}
              type="button"
              // Menekan tombol yang sama melepas pilihan — nilai kosong berarti
              // aspek itu tidak dinilai, bukan bernilai nol.
              onClick={() => setValue(active ? '' : String(preset))}
              aria-pressed={active}
              className={`h-8 w-11 rounded-md border text-sm tabular-nums transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-accent'
              }`}
            >
              {preset}
            </button>
          )
        })}
      </div>
      {/* Kolom angka inilah yang dikirim; tombol cepat hanya mengisinya,
          sehingga tidak ada dua sumber nilai yang bisa berselisih. */}
      <input
        type="number"
        name={name}
        inputMode="numeric"
        min={0}
        max={100}
        step="0.5"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="atau ketik nilai lain"
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        aria-label="Nilai angka"
      />
    </div>
  )
}
