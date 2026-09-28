'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { hapusTargetBulananAction, simpanAmbangAction, simpanTargetBulananAction } from '@/app/actions/target-bulanan'
import type { JenisTarget, TahapTangga } from '@/lib/rq/target-bulanan'
import type { Jenjang } from '@/types'
import { cn } from '@/lib/utils'

const KELAS_INPUT = 'h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export interface NilaiTarget {
  id: string | null
  awal_tahap: string | null
  awal_halaman: number | null
  akhir_tahap: string | null
  akhir_halaman: number | null
  awal_surat: number | null
  awal_ayat: number | null
  akhir_surat: number | null
  akhir_ayat: number | null
  keterangan: string
}

/**
 * Satu sel kelas × bulan. Yang boleh mengelola melihat tombol; yang lain
 * hanya teksnya. Formulirnya dialog kecil supaya tabel 12 bulan tetap
 * terbaca utuh.
 */
export function SelTarget({
  teks, keterangan, bolehUbah, judul, kunci, jenis, tangga, surat, nilai,
}: {
  teks: string | null
  keterangan: string
  bolehUbah: boolean
  judul: string
  kunci: { tahun_ajaran: string; bulan: string; jenjang: Jenjang; kelompok: string; tingkat: number }
  jenis: JenisTarget
  /** Tahsin: tangga metode kelas ini. */
  tangga: TahapTangga[]
  /** Tahfidz: nomor → nama surah. */
  surat: { nomor: number; nama: string }[]
  nilai: NilaiTarget
}) {
  const router = useRouter()
  const [buka, setBuka] = useState(false)
  const [pending, mulai] = useTransition()
  const [v, setV] = useState(nilai)
  const ubah = (p: Partial<NilaiTarget>) => setV(x => ({ ...x, ...p }))
  const berhalaman = (tahap: string | null) => !!tangga.find(t => t.label === tahap)?.total_pages

  const isi = (
    <span className="block">
      <span className={cn('block', teks ? 'text-foreground' : 'text-muted-foreground')}>{teks ?? '—'}</span>
      {keterangan && <span className="mt-0.5 block text-[11px] text-muted-foreground">{keterangan}</span>}
    </span>
  )
  if (!bolehUbah) return isi

  function simpan() {
    mulai(async () => {
      const r = await simpanTargetBulananAction({
        ...kunci, jenis,
        awal_tahap: v.awal_tahap, awal_halaman: berhalaman(v.awal_tahap) ? v.awal_halaman : null,
        akhir_tahap: v.akhir_tahap, akhir_halaman: berhalaman(v.akhir_tahap) ? v.akhir_halaman : null,
        awal_surat: v.awal_surat, awal_ayat: v.awal_ayat, akhir_surat: v.akhir_surat, akhir_ayat: v.akhir_ayat,
        keterangan: v.keterangan,
      })
      if (r.error) { toast.error(r.error); return }
      toast.success('Target tersimpan.')
      setBuka(false)
      router.refresh()
    })
  }

  function kosongkan() {
    if (!nilai.id) return
    mulai(async () => {
      const r = await hapusTargetBulananAction(nilai.id!)
      if (r.error) { toast.error(r.error); return }
      toast.success('Target dikosongkan.')
      setBuka(false)
      router.refresh()
    })
  }

  const pilihTahap = (sisi: 'awal' | 'akhir') => (
    <div className="grid grid-cols-[1fr_5rem] gap-2">
      <select
        value={(sisi === 'awal' ? v.awal_tahap : v.akhir_tahap) ?? ''}
        onChange={e => ubah(sisi === 'awal' ? { awal_tahap: e.target.value || null } : { akhir_tahap: e.target.value || null })}
        className={KELAS_INPUT}
      >
        <option value="">— Tahap —</option>
        {tangga.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
      </select>
      <input
        type="number" min={1} placeholder="hal."
        disabled={!berhalaman(sisi === 'awal' ? v.awal_tahap : v.akhir_tahap)}
        value={(sisi === 'awal' ? v.awal_halaman : v.akhir_halaman) ?? ''}
        onChange={e => {
          const n = e.target.value ? Number(e.target.value) : null
          ubah(sisi === 'awal' ? { awal_halaman: n } : { akhir_halaman: n })
        }}
        className={KELAS_INPUT}
        aria-label={`Halaman ${sisi}`}
      />
    </div>
  )

  const pilihAyat = (sisi: 'awal' | 'akhir') => (
    <div className="grid grid-cols-[1fr_5rem] gap-2">
      <select
        value={(sisi === 'awal' ? v.awal_surat : v.akhir_surat) ?? ''}
        onChange={e => {
          const n = e.target.value ? Number(e.target.value) : null
          ubah(sisi === 'awal' ? { awal_surat: n } : { akhir_surat: n })
        }}
        className={KELAS_INPUT}
      >
        <option value="">— Surat —</option>
        {surat.map(s => <option key={s.nomor} value={s.nomor}>{s.nomor}. {s.nama}</option>)}
      </select>
      <input
        type="number" min={1} placeholder="ayat"
        value={(sisi === 'awal' ? v.awal_ayat : v.akhir_ayat) ?? ''}
        onChange={e => {
          const n = e.target.value ? Number(e.target.value) : null
          ubah(sisi === 'awal' ? { awal_ayat: n } : { akhir_ayat: n })
        }}
        className={KELAS_INPUT}
        aria-label={`Ayat ${sisi}`}
      />
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => { setV(nilai); setBuka(true) }}
        className="group flex w-full items-start gap-1.5 rounded-md p-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">{isi}</span>
        {teks
          ? <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          : <Plus className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription>
              Rentang posisi yang dianggap <b>sesuai target</b> di akhir bulan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Dari</Label>
              {jenis === 'tahsin' ? pilihTahap('awal') : pilihAyat('awal')}
            </div>
            <div className="space-y-1.5">
              <Label>Sampai</Label>
              {jenis === 'tahsin' ? pilihTahap('akhir') : pilihAyat('akhir')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="keterangan">Keterangan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
              <Input id="keterangan" value={v.keterangan} onChange={e => ubah({ keterangan: e.target.value })}
                placeholder={jenis === 'tahfidz' ? 'mis. Murojaah & ujian' : 'mis. Fokus kelancaran'} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {nilai.id
              ? <Button type="button" variant="ghost" className="text-destructive" disabled={pending} onClick={kosongkan}>Kosongkan</Button>
              : <span />}
            <Button type="button" disabled={pending} onClick={simpan}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Lebar kategori di luar rentang sesuai, per unit & jenis. */
export function FormAmbang({ jenjang, jenis, bawah, atas }: { jenjang: Jenjang; jenis: JenisTarget; bawah: number; atas: number }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [b, setB] = useState(String(bawah))
  const [a, setA] = useState(String(atas))
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={e => {
        e.preventDefault()
        mulai(async () => {
          const r = await simpanAmbangAction(jenjang, jenis, Number(b), Number(a))
          if (r.error) { toast.error(r.error); return }
          toast.success('Ambang tersimpan.')
          router.refresh()
        })
      }}
    >
      <label className="flex w-36 flex-col gap-1 text-xs text-muted-foreground">Lebar &ldquo;di bawah&rdquo; (hal.)
        <input type="number" min={0} step="0.5" value={b} onChange={e => setB(e.target.value)} className={KELAS_INPUT} />
      </label>
      <label className="flex w-36 flex-col gap-1 text-xs text-muted-foreground">Lebar &ldquo;melampaui&rdquo; (hal.)
        <input type="number" min={0} step="0.5" value={a} onChange={e => setA(e.target.value)} className={KELAS_INPUT} />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan ambang'}</Button>
    </form>
  )
}
