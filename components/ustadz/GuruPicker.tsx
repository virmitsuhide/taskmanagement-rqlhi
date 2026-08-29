'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UNIT_PENUGASAN_LABELS } from '@/lib/auth/permissions'
import type { GuruRingkas } from '@/lib/data/guru-profil'
import type { Jenjang } from '@/types'

/**
 * Pemilih unit & nama guru untuk halaman Profil Guru.
 *
 * KENAPA DROPDOWN, BUKAN DERET CHIP
 *
 * Chip bagus untuk pilihan yang sedikit dan tetap. Unitnya memang lima, tapi
 * namanya bisa 22 orang dalam satu unit — deret chip sepanjang itu memakan
 * setengah layar sebelum profilnya sendiri terlihat, dan mata harus menyapu
 * seluruhnya untuk menemukan satu nama. Dropdown memuat berapa pun nama dalam
 * tinggi yang tetap, dan mengetik huruf awal langsung melompat ke sana.
 *
 * KENAPA <select> BIASA, BUKAN KOMPONEN COMBOBOX
 *
 * Di ponsel, <select> membuka pemilih bawaan sistem yang jauh lebih enak
 * daripada daftar melayang buatan sendiri — dan SDM memakai halaman ini sambil
 * memegang berkas, sering dari HP.
 */

const inputCls =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const UNITS: Jenjang[] = ['sd', 'sd_juara', 'smp', 'paud', 'sma']

interface Props {
  unit: Jenjang
  daftar: GuruRingkas[]
  terpilihId: string | null
}

export function GuruPicker({ unit, daftar, terpilihId }: Props) {
  const router = useRouter()

  const href = (u: Jenjang, guru: string | null) => {
    const q = new URLSearchParams({ unit: u })
    if (guru) q.set('guru', guru)
    return `/ustadz/profil?${q}`
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="pilih-unit" className="text-xs font-medium text-muted-foreground">
          Unit penugasan
        </label>
        <select
          id="pilih-unit"
          className={inputCls}
          value={unit}
          // Ganti unit membuang guru terpilih: nama dari unit lama tidak ada di
          // daftar unit baru, dan menyisakannya membuat profil yang tampil
          // tidak cocok dengan unit yang tertulis di atasnya.
          onChange={e => router.push(href(e.target.value as Jenjang, null))}
        >
          {UNITS.map(u => (
            <option key={u} value={u}>{UNIT_PENUGASAN_LABELS[u]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pilih-guru" className="text-xs font-medium text-muted-foreground">
          Nama guru <span className="font-normal">({daftar.length} orang, urut abjad)</span>
        </label>
        <select
          id="pilih-guru"
          className={inputCls}
          value={terpilihId ?? ''}
          disabled={daftar.length === 0}
          onChange={e => router.push(href(unit, e.target.value || null))}
        >
          <option value="">— pilih guru —</option>
          {daftar.map(g => (
            <option key={g.id} value={g.id}>
              {g.full_name}
              {/* Dua penanda yang paling sering dicari SDM, langsung di daftar
                  supaya tidak perlu membuka satu per satu untuk menemukannya. */}
              {!g.joined_at ? ' · TMT belum diisi' : !g.profilTerisi ? ' · profil kosong' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * Panah pindah ke profil sebelum/sesudahnya.
 *
 * Urutannya sama persis dengan dropdown (keduanya memakai daftar yang sudah
 * diurutkan di lib/data/guru-profil.ts), jadi "berikutnya" selalu berarti nama
 * di bawahnya pada dropdown — bukan tetangga menurut urutan lain yang kebetulan
 * dipakai kueri.
 *
 * Sengaja TIDAK memutar dari nama terakhir kembali ke yang pertama. Panah yang
 * tetap hidup di ujung daftar menghilangkan satu-satunya petunjuk bahwa SDM
 * sudah menelusuri seluruh unit.
 */
export function GuruPager({
  unit, daftar, terpilihId,
}: {
  unit: Jenjang
  daftar: GuruRingkas[]
  terpilihId: string
}) {
  const i = daftar.findIndex(g => g.id === terpilihId)
  const sebelum = i > 0 ? daftar[i - 1] : null
  const sesudah = i >= 0 && i < daftar.length - 1 ? daftar[i + 1] : null
  const href = (id: string) => `/ustadz/profil?unit=${unit}&guru=${id}`

  return (
    <div className="flex items-center justify-between gap-2">
      <PagerLink item={sebelum} href={sebelum ? href(sebelum.id) : null} arah="prev" />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {i >= 0 ? `${i + 1} dari ${daftar.length}` : ''}
      </span>
      <PagerLink item={sesudah} href={sesudah ? href(sesudah.id) : null} arah="next" />
    </div>
  )
}

function PagerLink({
  item, href, arah,
}: {
  item: GuruRingkas | null
  href: string | null
  arah: 'prev' | 'next'
}) {
  const Icon = arah === 'prev' ? ChevronLeft : ChevronRight
  const dasar = 'flex min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors'

  if (!item || !href) {
    return (
      <span
        className={`${dasar} cursor-default border-dashed text-muted-foreground/40`}
        aria-hidden
      >
        {arah === 'prev' && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="hidden sm:inline">{arah === 'prev' ? 'Awal daftar' : 'Akhir daftar'}</span>
        {arah === 'next' && <Icon className="h-3.5 w-3.5 shrink-0" />}
      </span>
    )
  }

  return (
    <Link
      href={href}
      className={`${dasar} bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground`}
      title={`${arah === 'prev' ? 'Sebelumnya' : 'Berikutnya'}: ${item.full_name}`}
    >
      {arah === 'prev' && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{item.full_name}</span>
      {arah === 'next' && <Icon className="h-3.5 w-3.5 shrink-0" />}
    </Link>
  )
}
