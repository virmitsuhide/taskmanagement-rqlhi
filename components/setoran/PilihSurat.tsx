'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cocokSurat, peringkatSurat, type SaranSurat } from '@/lib/rq/saran-surat'

export interface SuratOpsi {
  id: number
  name_latin: string
  total_ayat: number
}

/**
 * Isian surat yang bisa DIKETIK: "mulk", "naba", "67", "tabarak" langsung
 * menyaring 114 surat. Dropdown biasa tidak membantu di sini — hampir semua
 * nama diawali "Al-"/"An-", jadi lompat-huruf-awal tak berguna, dan di HP
 * guru harus menggulir panjang.
 *
 * `saran` (surat yang sudah dihafal anak) ditaruh paling atas, tapi daftar
 * lainnya TETAP bisa dipilih: catatan hafalan di sistem belum lengkap, dan
 * membatasi pilihan hanya membuat guru memilih surat yang salah. Bila yang
 * dipilih di luar `hafal`, muncul keterangan — bukan penolakan.
 */
export function PilihSurat({
  id, surat, value, onChange, saran, hafal, kosong, placeholder = 'Ketik nama atau nomor surat…',
  name, required, disabled, className,
}: {
  id?: string
  surat: SuratOpsi[]
  /** Id surat terpilih sebagai teks; '' = belum memilih (atau pilihan `kosong`). */
  value: string
  onChange: (v: string) => void
  saran?: SaranSurat | null
  /** Surat yang tercatat dihafal — untuk keterangan "belum tercatat hafal". */
  hafal?: Set<number> | null
  /** Label pilihan kosong yang SAH, mis. "Surat yang sama (Al-Mulk)". */
  kosong?: string
  placeholder?: string
  /** Nama field formulir (input tersembunyi) untuk formulir non-JS-state. */
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const uid = useId()
  const idInput = id ?? `pilih-surat-${uid}`
  const idDaftar = `${idInput}-daftar`
  const [buka, setBuka] = useState(false)
  const [kueri, setKueri] = useState('')
  const [sorot, setSorot] = useState(0)
  const daftarRef = useRef<HTMLUListElement>(null)

  const perId = useMemo(() => new Map(surat.map(s => [s.id, s])), [surat])
  const terpilih = perId.get(Number(value)) ?? null
  const labelTerpilih = terpilih ? `${terpilih.id}. ${terpilih.name_latin}` : value === '' && kosong ? kosong : ''

  // Baris daftar: [kosong] → saran → surat lain. Saat mengetik: hasil saran
  // dulu, lalu sisanya, masing-masing menurut peringkat kecocokan.
  const baris = useMemo(() => {
    const saranSet = new Set(saran?.ids ?? [])
    const cocok = surat.filter(s => cocokSurat(kueri, s))
    const urut = (a: SuratOpsi, b: SuratOpsi) => peringkatSurat(kueri, a) - peringkatSurat(kueri, b)
    const atas = cocok.filter(s => saranSet.has(s.id)).sort(urut)
    const bawah = cocok.filter(s => !saranSet.has(s.id)).sort(urut)
    const hasil: ({ jenis: 'judul'; teks: string } | { jenis: 'opsi'; nilai: string; teks: string; sub?: string })[] = []
    if (kosong && !kueri.trim()) hasil.push({ jenis: 'opsi', nilai: '', teks: kosong })
    if (atas.length) {
      hasil.push({ jenis: 'judul', teks: `Sudah dihafal · ${saran!.judul}` })
      for (const s of atas) hasil.push({ jenis: 'opsi', nilai: String(s.id), teks: `${s.id}. ${s.name_latin}`, sub: `${s.total_ayat} ayat` })
    }
    if (bawah.length) {
      if (atas.length) hasil.push({ jenis: 'judul', teks: 'Surat lain' })
      for (const s of bawah) hasil.push({ jenis: 'opsi', nilai: String(s.id), teks: `${s.id}. ${s.name_latin}`, sub: `${s.total_ayat} ayat` })
    }
    return hasil
  }, [surat, kueri, saran, kosong])

  const opsi = baris.flatMap((b, i) => (b.jenis === 'opsi' ? [{ ...b, i }] : []))

  function pilih(nilai: string) {
    onChange(nilai)
    setBuka(false)
    setKueri('')
  }

  function gulirKe(n: number) {
    const el = daftarRef.current?.querySelector(`[data-n="${n}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  function tombol(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!buka) { setBuka(true); return }
      const n = Math.max(0, Math.min(opsi.length - 1, sorot + (e.key === 'ArrowDown' ? 1 : -1)))
      setSorot(n)
      gulirKe(n)
    } else if (e.key === 'Enter') {
      if (buka && opsi[sorot]) { e.preventDefault(); pilih(opsi[sorot].nilai) }
    } else if (e.key === 'Escape') {
      setBuka(false)
      setKueri('')
    }
  }

  const diLuarHafalan = Boolean(hafal && terpilih && !hafal.has(terpilih.id))

  return (
    <div className={cn('relative min-w-0', className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id={idInput}
          type="text"
          role="combobox"
          aria-expanded={buka}
          aria-controls={idDaftar}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="done"
          disabled={disabled}
          required={required && !value && !kosong}
          placeholder={labelTerpilih || placeholder}
          value={buka ? kueri : labelTerpilih}
          onFocus={() => { setBuka(true); setKueri(''); setSorot(0) }}
          onBlur={() => { setBuka(false); setKueri('') }}
          onChange={e => { setKueri(e.target.value); setBuka(true); setSorot(0) }}
          onKeyDown={tombol}
          className={cn(
            'h-11 w-full min-w-0 rounded-xl border bg-card pl-9 pr-9 text-sm outline-none transition-colors',
            'placeholder:text-muted-foreground focus:border-primary disabled:opacity-60',
            buka && labelTerpilih && 'placeholder:text-foreground/60',
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>

      {buka && (
        <ul
          id={idDaftar}
          ref={daftarRef}
          role="listbox"
          // Mencegah input kehilangan fokus sebelum klik pilihan terbaca.
          onMouseDown={e => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {opsi.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ada surat &ldquo;{kueri}&rdquo;</li>
          )}
          {baris.map((b, i) => {
            if (b.jenis === 'judul') {
              return (
                <li key={`j${i}`} role="presentation" className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {b.teks}
                </li>
              )
            }
            const n = opsi.findIndex(o => o.i === i)
            const aktif = n === sorot
            const dipilih = b.nilai === value
            return (
              <li
                key={`o${b.nilai}`}
                role="option"
                aria-selected={dipilih}
                data-n={n}
                onClick={() => pilih(b.nilai)}
                onMouseEnter={() => setSorot(n)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  aktif && 'bg-accent',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{b.teks}</span>
                {b.sub && <span className="shrink-0 text-xs text-muted-foreground">{b.sub}</span>}
                {dipilih && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
              </li>
            )
          })}
        </ul>
      )}

      {diLuarHafalan && (
        <p className="mt-1 text-[11px] text-warning">
          {terpilih!.name_latin} belum tercatat dihafal anak ini — tetap boleh disimpan.
        </p>
      )}
    </div>
  )
}
