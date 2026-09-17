'use client'

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AtSign, Users } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { MAX_ANGGOTA, pengurusDisebut, type PengurusMention } from '@/lib/rutin/bersama'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  name: string
  defaultValue?: string
  rows?: number
  maxLength?: number
  required?: boolean
  placeholder?: string
  /** Pengurus yang bisa diajak — tanpa pemirsa sendiri. */
  pengurus: PengurusMention[]
  className?: string
}

/**
 * Deskripsi tugas rutin yang mengenali "@jabatan".
 *
 * Mengetik "@" membuka daftar pengurus; memilih satu menyisipkan labelnya
 * utuh ("@Koor SD "), sehingga teks yang tersimpan persis sama dengan yang
 * dibaca server untuk menentukan siapa yang diajak. Tidak ada daftar tersembunyi
 * terpisah dari teks: menghapus "@SDM" dari kalimat berarti SDM tidak diajak.
 */
export const DeskripsiMention = forwardRef<HTMLTextAreaElement, Props>(function DeskripsiMention(
  { id, name, defaultValue = '', rows = 3, maxLength = 300, required, placeholder, pengurus, className },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => areaRef.current!, [])
  const [teks, setTeks] = useState(defaultValue)
  const [cari, setCari] = useState<{ awal: number; kata: string } | null>(null)
  const [aktif, setAktif] = useState(0)

  const kandidat = useMemo(() => {
    if (!cari) return []
    const k = cari.kata.toLowerCase()
    return pengurus
      .filter(p => p.label.toLowerCase().startsWith(k) || (k.length >= 2 && p.nama.toLowerCase().includes(k)))
      .slice(0, 8)
  }, [cari, pengurus])

  const disebut = useMemo(() => pengurusDisebut(teks, pengurus), [teks, pengurus])

  function periksaSebutan(nilai: string, caret: number) {
    // "@" di awal kata, diikuti paling banyak 30 karakter tanpa ganti baris —
    // label jabatan boleh berspasi ("Koor QULS SD").
    const m = /(?:^|\s)@([^@\n]{0,30})$/.exec(nilai.slice(0, caret))
    if (!m) { setCari(null); return }
    setCari({ awal: caret - m[1].length - 1, kata: m[1] })
    setAktif(0)
  }

  function pilih(p: PengurusMention) {
    const el = areaRef.current
    if (!el || !cari) return
    const caret = el.selectionStart ?? teks.length
    const sisip = `@${p.label} `
    const baru = (teks.slice(0, cari.awal) + sisip + teks.slice(caret)).slice(0, maxLength)
    setTeks(baru)
    setCari(null)
    requestAnimationFrame(() => {
      el.focus()
      const pos = Math.min(cari.awal + sisip.length, baru.length)
      el.setSelectionRange(pos, pos)
    })
  }

  const terbuka = cari !== null && kandidat.length > 0

  return (
    <div className="relative">
      <Textarea
        ref={areaRef}
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        value={teks}
        className={className}
        aria-autocomplete="list"
        aria-expanded={terbuka}
        aria-controls={`${id}-saran`}
        onChange={e => { setTeks(e.target.value); periksaSebutan(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
        onClick={e => periksaSebutan(teks, e.currentTarget.selectionStart ?? teks.length)}
        onBlur={() => setTimeout(() => setCari(null), 120)}
        onKeyDown={e => {
          if (!terbuka) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setAktif(i => (i + 1) % kandidat.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif(i => (i - 1 + kandidat.length) % kandidat.length) }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pilih(kandidat[aktif]) }
          else if (e.key === 'Escape') { e.preventDefault(); setCari(null) }
        }}
      />

      {terbuka && (
        <ul
          id={`${id}-saran`}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {kandidat.map((p, i) => (
            <li key={p.userId} role="option" aria-selected={i === aktif}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); pilih(p) }}
                onMouseEnter={() => setAktif(i)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', i === aktif && 'bg-accent')}
              >
                <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{p.label}</span>
                <span className="truncate text-xs text-muted-foreground">{p.nama}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {disebut.length > 0 ? (
        <p className={cn('mt-1.5 flex flex-wrap items-center gap-1 text-[11px]', disebut.length > MAX_ANGGOTA ? 'text-destructive' : 'text-muted-foreground')}>
          <Users className="h-3.5 w-3.5" />
          Dikerjakan bersama:
          {disebut.map(p => (
            <span key={p.userId} className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{p.label}</span>
          ))}
          <span>
            {disebut.length > MAX_ANGGOTA
              ? `— paling banyak ${MAX_ANGGOTA} rekan.`
              : '— mereka menerima ajakan dulu, dan laporan terlaksana perlu dikonfirmasi rekan.'}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Dikerjakan bersama pengurus lain? Ketik <strong>@</strong> lalu pilih jabatannya, mis. &ldquo;Rekrutmen guru Qur&apos;an bersama @SDM&rdquo;.
        </p>
      )}
    </div>
  )
})
