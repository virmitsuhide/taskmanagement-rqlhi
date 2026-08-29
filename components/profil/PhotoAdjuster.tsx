'use client'

import { useState } from 'react'
import { Crop, RotateCcw, UserRound } from 'lucide-react'
import { DEFAULT_FOCUS, isDefaultFocus, photoStyle } from '@/lib/profil/foto'
import { PhotoCropDialog } from './PhotoCropDialog'
import type { PhotoFocus } from '@/types'

interface Props {
  /** Awalan nama field tersembunyi: `${name}_x`, `${name}_y`, `${name}_zoom`. */
  name: string
  src: string | null
  initial?: PhotoFocus
  /** Diameter lingkaran dalam piksel. */
  size?: number
  /** Sembunyikan keterangan di bawah lingkaran — untuk baris daftar yang padat. */
  compact?: boolean
  label?: string
}

/**
 * Lingkaran foto yang bisa diatur. Diketuk, ia membuka jendela pengatur
 * (PhotoCropDialog); di luar itu ia hanya pratinjau.
 *
 * KENAPA PENGATURANNYA PINDAH KE JENDELA TERSENDIRI
 *
 * Dulu foto digeser langsung di lingkaran kecil ini — 56px di panel Humas,
 * 88px di form profil. Di ruang sesempit itu seluruh foto tidak pernah
 * terlihat, jadi orang menggeser tanpa tahu apa yang sedang ia lewatkan, dan
 * satu piksel seretan menggeser bagian yang besar. Jendela terpisah memberi
 * kanvas yang cukup luas untuk memperlihatkan foto utuh sekaligus lingkaran
 * yang menandai bagian yang akan tampil.
 *
 * Nilai akhirnya tetap dikirim lewat input tersembunyi, jadi komponen ini
 * masih menyatu dengan <form action={…}> biasa tanpa perlu state di
 * pemanggilnya. Itu penting justru karena dialognya di-portal ke luar <form>:
 * input yang menyimpan hasilnya harus tetap tinggal di sini, di dalam form.
 *
 * Yang disimpan titik fokusnya, bukan hasil potongan — berkas asli tetap utuh
 * dan potongannya dihitung ulang CSS di tiap ukuran lingkaran. Lihat
 * drizzle/0040 untuk alasan lengkapnya.
 */
export function PhotoAdjuster({
  name, src, initial, size = 96, compact = false, label,
}: Props) {
  const [focus, setFocus] = useState<PhotoFocus>(initial ?? DEFAULT_FOCUS)
  const [open, setOpen] = useState(false)

  const judul = label ? `Atur Foto ${label}` : 'Atur Foto Profil'

  return (
    <div className={compact ? 'flex flex-col items-start gap-1' : 'space-y-2'}>
      <input type="hidden" name={`${name}_x`} value={Math.round(focus.x)} />
      <input type="hidden" name={`${name}_y`} value={Math.round(focus.y)} />
      <input type="hidden" name={`${name}_zoom`} value={Math.round(focus.zoom)} />

      {/*
        type="button" bukan hiasan: komponen ini hidup di dalam <form>, dan
        tombol tanpa type akan berperilaku submit — mengetuk foto justru
        mengirim seluruh formulir.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!src}
        aria-label={src ? judul : 'Belum ada foto untuk diatur'}
        title={src ? 'Ketuk untuk mengatur posisi foto' : undefined}
        style={{ width: size, height: size }}
        className={`group relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${src ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="h-full w-full select-none"
              style={photoStyle(focus)}
            />
            <span
              className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            >
              <Crop style={{ width: size / 4, height: size / 4 }} />
            </span>
          </>
        ) : (
          <UserRound className="h-1/3 w-1/3 text-muted-foreground" />
        )}
      </button>

      {src && !compact && (
        <div className="flex items-center gap-2" style={{ maxWidth: 220 }}>
          <p className="text-[11px] text-muted-foreground">Ketuk foto untuk mengatur posisi.</p>
          {!isDefaultFocus(focus) && (
            <button
              type="button"
              onClick={() => setFocus(DEFAULT_FOCUS)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />Atur ulang
            </button>
          )}
        </div>
      )}

      {src && compact && !isDefaultFocus(focus) && (
        <button
          type="button"
          onClick={() => setFocus(DEFAULT_FOCUS)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-2.5 w-2.5" />Atur ulang
        </button>
      )}

      {src && (
        <PhotoCropDialog
          open={open}
          onOpenChange={setOpen}
          src={src}
          value={focus}
          onSave={setFocus}
          title={judul}
        />
      )}
    </div>
  )
}
