'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Check, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { simpanSuasanaAction, type PortalTampilan } from '@/app/actions/tampilan'
import {
  KUNCI_PAKSA_TERANG, LABEL_UKURAN, SUASANA, SUASANA_GELAP, SUASANA_TERANG, UKURAN_TEKS,
  terapkanPrefDiPeramban,
  type PilihanGelap, type PrefTampilan, type Suasana, type UkuranTeks,
} from '@/lib/tampilan/suasana'

/**
 * Halaman Tampilan — pilih suasana (palet) dan ukuran teks untuk akun ini.
 *
 * Dipakai bersama oleh tiga portal (pengurus, guru, karyawan); halaman rute
 * masing-masing hanya menjaga sesi dan membaca pilihan tersimpan. Memilih
 * hanya mempratinjau (atribut <html>, tanpa cookie); baru tombol Simpan yang
 * memasang cookie & menyimpan ke akun. Batalkan — atau meninggalkan halaman
 * tanpa menyimpan — mengembalikan pilihan tersimpan.
 */
export function PilihSuasana({
  portal,
  awal,
  kembaliHref,
  kembaliLabel = 'Profil saya',
}: {
  portal: PortalTampilan
  awal: PrefTampilan
  kembaliHref: string
  kembaliLabel?: string
}) {
  const [tersimpan, setTersimpan] = React.useState<PrefTampilan>(awal)
  const [pref, setPref] = React.useState<PrefTampilan>(awal)
  const [menyimpan, startSimpan] = React.useTransition()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const berubah = !samaPref(pref, tersimpan)

  // Pilihan yang tersimpan di akun (mungkin diubah dari perangkat lain) ikut
  // dipasang di perangkat ini begitu halaman dibuka.
  React.useEffect(() => {
    terapkanPrefDiPeramban(awal)
  }, [awal])

  // Keluar halaman tanpa menyimpan: pratinjau dikembalikan ke yang tersimpan.
  const tersimpanRef = React.useRef(tersimpan)
  React.useEffect(() => {
    tersimpanRef.current = tersimpan
  }, [tersimpan])
  React.useEffect(() => () => terapkanPrefDiPeramban(tersimpanRef.current, { cookie: false }), [])

  function ubah(perubahan: Partial<PrefTampilan>) {
    const baru: PrefTampilan = { ...pref, ...perubahan }
    if (samaPref(baru, pref)) return
    setPref(baru)
    terapkanPrefDiPeramban(baru, { cookie: false })
  }

  function batalkan() {
    setPref(tersimpan)
    terapkanPrefDiPeramban(tersimpan, { cookie: false })
  }

  function simpan() {
    const baru = pref
    startSimpan(async () => {
      terapkanPrefDiPeramban(baru)
      if (baru.gelap !== tersimpan.gelap) aturMode(baru.gelap)
      setTersimpan(baru)
      try {
        const hasil = await simpanSuasanaAction({ ...baru, portal })
        if (!hasil.ok) toast.error(hasil.error)
        else if (!hasil.akun) toast.info('Tersimpan di perangkat ini saja — pembaruan basis data (0116) belum dijalankan.')
        else toast.success('Tampilan disimpan untuk akun Anda.')
      } catch {
        toast.error('Tampilan sudah dipakai di perangkat ini, tapi gagal disimpan ke akun.')
      }
    })
  }

  /** "Tetap terang" memaku mode ke terang; kembali ke suasana gelap melepasnya. */
  function aturMode(gelap: PilihanGelap) {
    try {
      if (gelap === 'terang') {
        if (theme === 'system' || resolvedTheme === 'dark') {
          setTheme('light')
          localStorage.setItem(KUNCI_PAKSA_TERANG, '1')
        }
      } else if (localStorage.getItem(KUNCI_PAKSA_TERANG) === '1') {
        localStorage.removeItem(KUNCI_PAKSA_TERANG)
        setTheme('system')
      }
    } catch {
      /* localStorage tidak tersedia — mode dibiarkan */
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
      <Link
        href={kembaliHref}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline md:min-h-0"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {kembaliLabel}
      </Link>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-accent-warm">Tampilan</p>
      <h1 className="mt-1 font-heading text-3xl leading-tight md:text-4xl">
        Pilih <em>suasana</em> ruang kerja Anda
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
        Hanya warna dan nuansa yang berubah — menu, data, dan letak tombol tetap sama.
        Pilihan ini hanya berlaku untuk akun Anda.
      </p>

      <fieldset className="mt-7">
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Terang</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {SUASANA_TERANG.map(id => (
            <KartuSuasana
              key={id}
              id={id}
              name="suasana-terang"
              terpilih={pref.terang === id}
              onPilih={() => ubah({ terang: id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Gelap</legend>
        <p className="mb-3 text-xs text-muted-foreground">Dipakai ketika mode gelap aktif.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {SUASANA_GELAP.map(id => (
            <KartuSuasana
              key={id}
              id={id}
              name="suasana-gelap"
              terpilih={pref.gelap === id}
              onPilih={() => ubah({ gelap: id })}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <fieldset className="rounded-2xl border bg-card p-5 md:p-6">
          <legend className="sr-only">Saat perangkat dalam mode gelap</legend>
          <p aria-hidden className="font-heading text-xl">Saat perangkat dalam mode gelap</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Suasana terang dipakai siang hari; malam hari bisa berganti sendiri.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ['malam', 'Ganti ke Tilawah Malam', 'Otomatis mengikuti jam/perangkat'],
                ['senja', 'Ganti ke Senja', 'Gelap hangat'],
                ['terang', 'Tetap suasana pilihan', 'Tidak ikut mode gelap'],
              ] as [PilihanGelap, string, string][]
            ).map(([nilai, judul, sub]) => {
              const aktif = pref.gelap === nilai
              return (
                <label
                  key={nilai}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                    aktif ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted/50',
                  )}
                >
                  <input
                    type="radio"
                    name="saat-gelap"
                    value={nilai}
                    checked={aktif}
                    onChange={() => ubah({ gelap: nilai })}
                    className="sr-only"
                  />
                  <TitikRadio aktif={aktif} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug">{judul}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border bg-card p-5 md:p-6">
          <legend className="sr-only">Ukuran teks</legend>
          <p aria-hidden className="font-heading text-xl">Ukuran teks</p>
          <div className="mt-4 inline-flex rounded-xl bg-muted p-1">
            {UKURAN_TEKS.map((u: UkuranTeks) => {
              const aktif = pref.ukuran === u
              return (
                <label
                  key={u}
                  className={cn(
                    'flex min-h-11 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-lg px-4 font-bold transition-colors',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    u === 'kecil' ? 'text-sm' : u === 'biasa' ? 'text-base' : 'text-lg',
                    aktif ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="ukuran-teks"
                    value={u}
                    checked={aktif}
                    onChange={() => ubah({ ukuran: u })}
                    className="sr-only"
                  />
                  {LABEL_UKURAN[u]}
                </label>
              )
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Disimpan untuk akun Anda — ikut ke ponsel dan laptop.</p>
        </fieldset>
      </div>

      <div className="sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:p-4">
        <p className="min-w-0 text-sm" aria-live="polite">
          {berubah ? (
            <span className="font-semibold">Pratinjau — belum disimpan</span>
          ) : (
            <span className="text-muted-foreground">Tampilan ini sudah tersimpan di akun Anda.</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={batalkan} disabled={!berubah || menyimpan} className="min-h-11 md:min-h-9">
            Batalkan
          </Button>
          <Button type="button" onClick={simpan} disabled={!berubah || menyimpan} className="min-h-11 md:min-h-9">
            {menyimpan ? 'Menyimpan…' : 'Simpan tampilan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function samaPref(a: PrefTampilan, b: PrefTampilan) {
  return a.terang === b.terang && a.gelap === b.gelap && a.ukuran === b.ukuran
}

function TitikRadio({ aktif }: { aktif: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
        aktif ? 'border-primary' : 'border-muted-foreground/50',
      )}
    >
      {aktif && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
    </span>
  )
}

/** Kartu satu suasana dengan pratinjau mini yang digambar dari paletnya sendiri. */
function KartuSuasana({
  id,
  name,
  terpilih,
  onPilih,
}: {
  id: Suasana
  name: string
  terpilih: boolean
  onPilih: () => void
}) {
  const s = SUASANA[id]
  const w = s.warna
  const garis = id === 'kontras' ? w.fg : w.border

  return (
    <label
      className={cn(
        'group flex cursor-pointer flex-col rounded-2xl border bg-card p-2.5 transition-shadow md:p-3',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
        terpilih ? 'border-primary ring-1 ring-primary' : 'hover:shadow-sm',
      )}
    >
      <input type="radio" name={name} value={id} checked={terpilih} onChange={onPilih} className="sr-only" />

      {/* Pratinjau: sidebar, salam, tiga kartu, tombol utama & penanda. */}
      <div
        aria-hidden
        className="flex h-24 overflow-hidden rounded-xl border sm:h-28"
        style={{ background: w.bg, borderColor: garis }}
      >
        <div className="w-[22%] max-w-12 shrink-0 space-y-1 px-1.5 pt-2.5" style={{ background: w.side }}>
          <span className="block h-1 rounded-full" style={{ background: w.sideacc }} />
          <span className="block h-1 rounded-full opacity-70" style={{ background: w.sidemute }} />
          <span className="block h-1 rounded-full opacity-70" style={{ background: w.sidemute }} />
        </div>
        <div className="min-w-0 flex-1 px-2 pt-2 sm:px-2.5">
          <p className="truncate font-heading text-[13px] leading-tight sm:text-sm" style={{ color: w.fg }}>
            Assalamu’alaikum
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-1 sm:mt-2 sm:gap-1.5">
            {[w.primary, w.warm, w.info].map((c, i) => (
              <div
                key={i}
                className="flex h-7 items-end rounded-md p-1 sm:h-9 sm:p-1.5"
                style={{ background: w.card, border: `1px solid ${garis}` }}
              >
                <span className="block h-[3px] w-3/5 rounded-full" style={{ background: c }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1 sm:mt-2 sm:gap-1.5">
            <span className="block h-3 w-10 rounded sm:h-3.5 sm:w-12" style={{ background: w.primary }} />
            <span className="block h-3 w-7 rounded sm:h-3.5 sm:w-9" style={{ background: w.wwash }} />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2 px-0.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug">{s.nama}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{s.sub}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            terpilih ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
          )}
        >
          {terpilih && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </div>

      <div aria-hidden className="mt-2.5 flex h-1 overflow-hidden rounded-full">
        <span className="flex-1" style={{ background: w.side }} />
        <span className="flex-1" style={{ background: w.bg }} />
        <span className="flex-1" style={{ background: w.seri[0] }} />
        <span className="flex-1" style={{ background: w.seri[1] }} />
      </div>
    </label>
  )
}
