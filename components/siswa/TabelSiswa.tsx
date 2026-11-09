'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiswaRowActions } from '@/components/siswa/SiswaRowActions'
import type { Baris, SortKey } from '@/lib/data/daftar-siswa'

/**
 * Tabel siswa satu rombel + centang untuk unduhan Excel.
 *
 * Centang hanya hidup di peramban: ia pilihan sesaat untuk satu unduhan,
 * bukan data. Halaman induk memberi `key` per rombel & pencarian, jadi
 * berpindah kelas mengosongkannya — centang 4A tidak terbawa ke 4B.
 */
export function TabelSiswa({
  baris, bolehUbah, sort, dir, hrefSort, unduh, kelas, labelAngkatan, jumlahAngkatan,
}: {
  baris: Baris[]
  bolehUbah: boolean
  sort: SortKey
  dir: 'asc' | 'desc'
  hrefSort: Record<SortKey, string>
  /** Parameter dasar /siswa/unduh: jenjang, tingkat, kelas, q, sort, dir. */
  unduh: Record<string, string>
  kelas: string
  labelAngkatan: string
  jumlahAngkatan: number
}) {
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const semua = baris.length > 0 && dipilih.size === baris.length

  const urlUnduh = (lingkup: 'kelas' | 'angkatan' | 'pilihan') => {
    const p = new URLSearchParams({ ...unduh, lingkup })
    // Ikut urutan layar, bukan urutan klik centang.
    if (lingkup === 'pilihan') p.set('ids', baris.filter(b => dipilih.has(b.id)).map(b => b.id).join(','))
    return `/siswa/unduh?${p.toString()}`
  }

  const ganti = (id: string) => setDipilih(prev => {
    const baru = new Set(prev)
    if (baru.has(id)) baru.delete(id)
    else baru.add(id)
    return baru
  })

  const tombol = 'inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors'

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
          <Download className="h-3.5 w-3.5" />Unduh capaian (Excel)
        </span>
        <a href={urlUnduh('kelas')} download className={cn(tombol, 'bg-card hover:bg-muted')}>
          Kelas {kelas} <span className="font-normal tabular-nums opacity-70">{baris.length}</span>
        </a>
        <a href={urlUnduh('angkatan')} download className={cn(tombol, 'bg-card hover:bg-muted')}>
          Seangkatan {labelAngkatan} <span className="font-normal tabular-nums opacity-70">{jumlahAngkatan}</span>
        </a>
        {dipilih.size > 0 ? (
          <a href={urlUnduh('pilihan')} download className={cn(tombol, 'border-primary bg-primary text-primary-foreground hover:opacity-90')}>
            Yang dicentang <span className="font-normal tabular-nums opacity-80">{dipilih.size}</span>
          </a>
        ) : (
          <span className={cn(tombol, 'cursor-default border-dashed text-muted-foreground')}>
            Centang siswa untuk unduh sebagian
          </span>
        )}
      </div>

      {/* Tabel lebar menggulir di dalam wadahnya sendiri — halamannya tidak
          ikut bergeser mendatar di layar sempit. */}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="w-10 py-3 pl-5 pr-1">
                <input
                  type="checkbox"
                  aria-label="Centang semua siswa di kelas ini"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={semua}
                  ref={el => { if (el) el.indeterminate = dipilih.size > 0 && !semua }}
                  onChange={() => setDipilih(semua ? new Set() : new Set(baris.map(b => b.id)))}
                />
              </th>
              <Th href={hrefSort.nama} aktif={sort === 'nama'} dir={dir}>Nama</Th>
              <th className="px-3 py-3 text-left font-bold">Kelas</th>
              <Th href={hrefSort.pengampu} aktif={sort === 'pengampu'} dir={dir}>Pengampu · halaqoh</Th>
              <Th href={hrefSort.tahsin} aktif={sort === 'tahsin'} dir={dir}>Tahsin</Th>
              <Th href={hrefSort.tahfidz} aktif={sort === 'tahfidz'} dir={dir}>Tahfidz</Th>
              {bolehUbah && <th className="w-20 px-3 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {baris.map(s => {
              const on = dipilih.has(s.id)
              return (
                <tr key={s.id} className={cn('transition-colors hover:bg-muted/30', on && 'bg-primary/5')}>
                  <td className="py-3 pl-5 pr-1">
                    <input
                      type="checkbox"
                      aria-label={`Centang ${s.full_name}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={on}
                      onChange={() => ganti(s.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/siswa/${s.id}`} className="font-bold hover:underline">
                      {s.full_name}
                    </Link>
                    {s.nis && (
                      <span className="block text-xs text-muted-foreground">NIS {s.nis}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-bold">{s.kelas ?? '—'}</td>
                  <td className="px-3 py-3">
                    {s.pengampu
                      ? <span className="font-semibold">{s.pengampu}</span>
                      : <span className="font-semibold text-accent-warm">tanpa pengampu</span>}
                    {s.halaqoh && (
                      <span className="block text-xs text-muted-foreground">{s.halaqoh}</span>
                    )}
                  </td>
                  <td className={cn('px-3 py-3', s.tahsinLabel === '—' && 'text-accent-warm')}>
                    {s.tahsinLabel === '—' ? 'belum tercatat' : s.tahsinLabel}
                  </td>
                  <td className={cn('px-3 py-3', s.tahfidzLabel === '—' && 'text-accent-warm')}>
                    {s.tahfidzLabel === '—' ? 'belum tercatat' : s.tahfidzLabel}
                  </td>
                  {bolehUbah && (
                    <td className="px-3 py-3 pr-5">
                      <SiswaRowActions id={s.id} name={s.full_name} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Kepala kolom yang bisa diklik untuk mengurutkan. */
function Th({
  href, aktif, dir, children,
}: { href: string; aktif: boolean; dir: 'asc' | 'desc'; children: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-left font-bold">
      <Link href={href} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {aktif && (dir === 'asc'
          ? <ArrowUp className="h-3 w-3" />
          : <ArrowDown className="h-3 w-3" />)}
      </Link>
    </th>
  )
}
