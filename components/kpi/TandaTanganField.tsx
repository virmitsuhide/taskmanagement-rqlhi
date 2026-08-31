'use client'

import { useRef, useState } from 'react'
import { PenLine, RotateCcw, Trash2, Upload } from 'lucide-react'
import {
  DEFAULT_TTD_FOCUS, isDefaultTtdFocus, ttdStyle, TTD_ZOOM_MAX, TTD_ZOOM_MIN,
} from '@/lib/kpi/tanda-tangan'
import type { SignatureFocus } from '@/types'

interface Props {
  /** Awalan medan tersembunyi: `ttd_x`, `ttd_y`, `ttd_zoom`. */
  name?: string
  /** URL bertanda tangan dari server, atau null bila belum pernah mengunggah. */
  src: string | null
  initial?: SignatureFocus
  /** Nama yang tercetak di bawah garis — supaya pratinjaunya terasa nyata. */
  nama?: string
}

/**
 * Medan tanda tangan: unggah gambar, lalu tata letaknya di dalam kotak yang
 * bentuknya sama dengan kotak tanda tangan di lembar rapor.
 *
 * KENAPA PRATINJAUNYA MENIRU KOTAK RAPOR
 *
 * Yang diatur di sini bukan gambar berdiri sendiri, melainkan bagaimana ia
 * akan duduk di atas garis nama di rapor. Pratinjau berbentuk kotak bebas
 * membuat orang menata sesuatu yang tidak pernah ia lihat hasilnya, dan
 * kesalahannya baru ketahuan setelah tiga puluh rapor terbit dengan tanda
 * tangan yang menabrak garis.
 *
 * Berbeda dari PhotoAdjuster, tidak ada jendela pemotong: tanda tangan tidak
 * pernah dipangkas (object-fit: contain), jadi tidak ada "bagian yang
 * terbuang" yang perlu ditunjukkan. Yang perlu diatur hanya besar dan
 * letaknya, dan tiga penggeser cukup untuk itu.
 */
export function TandaTanganField({ name = 'ttd', src, initial, nama }: Props) {
  const [focus, setFocus] = useState<SignatureFocus>(initial ?? DEFAULT_TTD_FOCUS)
  const [preview, setPreview] = useState<string | null>(src)
  const [hapus, setHapus] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pilihBerkas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    // Pratinjau langsung dari berkas lokal: menunggu unggahan selesai untuk
    // memperlihatkan hasilnya membuat penataan jadi menebak-nebak.
    setPreview(URL.createObjectURL(f))
    setHapus(false)
  }

  const set = (k: keyof SignatureFocus) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFocus(f => ({ ...f, [k]: Number(e.target.value) }))

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={`${name}_x`} value={Math.round(focus.x)} />
      <input type="hidden" name={`${name}_y`} value={Math.round(focus.y)} />
      <input type="hidden" name={`${name}_zoom`} value={Math.round(focus.zoom)} />
      <input type="hidden" name={`${name}_hapus`} value={hapus ? '1' : '0'} />

      <div className="flex flex-wrap items-start gap-4">
        {/* Kotak pratinjau — proporsinya mengikuti kolom TTD di lembar rapor. */}
        <div className="w-[190px] shrink-0">
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Pratinjau di rapor</p>
          <div className="rounded-md border bg-card px-3 pb-2 pt-1.5 text-center">
            <p className="text-[9.5px] font-semibold text-muted-foreground">Koordinator,</p>
            <div className="relative h-11 overflow-hidden">
              {preview && !hapus ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Tanda tangan"
                  className="h-full w-full"
                  style={ttdStyle(focus)}
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[9px] text-muted-foreground">
                  ruang tanda tangan basah
                </span>
              )}
            </div>
            <p className="border-t pt-1 text-[10px] font-bold">{nama ?? 'Nama Penanda Tangan'}</p>
          </div>
        </div>

        <div className="min-w-[210px] flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            name={`${name}_file`}
            accept="image/png,image/webp,image/jpeg"
            onChange={pilihBerkas}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {preview && !hapus ? 'Ganti gambar' : 'Unggah gambar'}
            </button>
            {preview && !hapus && (
              <button
                type="button"
                onClick={() => { setHapus(true); setPreview(null) }}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive-wash"
              >
                <Trash2 className="h-3.5 w-3.5" />Hapus
              </button>
            )}
            {!isDefaultTtdFocus(focus) && (
              <button
                type="button"
                onClick={() => setFocus(DEFAULT_TTD_FOCUS)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />Atur ulang
              </button>
            )}
          </div>

          {preview && !hapus && (
            <div className="space-y-1.5">
              <Geser label="Besar" value={focus.zoom} min={TTD_ZOOM_MIN} max={TTD_ZOOM_MAX} onChange={set('zoom')} />
              <Geser label="Mendatar" value={focus.x} min={0} max={100} onChange={set('x')} />
              <Geser label="Tegak" value={focus.y} min={0} max={100} onChange={set('y')} />
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <PenLine className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Paling baik PNG berlatar transparan, maksimal 1 MB. Gambar berlatar
              putih akan menutupi garis nama di bawahnya.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Geser({
  label, value, min, max, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={onChange} className="flex-1" />
      <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{Math.round(value)}</span>
    </label>
  )
}
