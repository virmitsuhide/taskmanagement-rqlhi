'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bacaUlangTemplateAction, hapusTemplateAction, ubahTemplateAction } from '@/app/actions/rapor-template'
import { SELECT_NATIF } from '@/components/rapor/kontrol'
import { JENIS_RAPOR, LABEL_JENIS_RAPOR, type JenisRapor } from '@/lib/rapor/jenis'

/**
 * Pengaturan template: nama, kelas berapa yang memakainya, aktif/tidak.
 *
 * Menonaktifkan lebih dipilih daripada menghapus: rapor yang sudah dicetak
 * semester lalu menunjuk template ini, dan daftar isian guru ikut kehilangan
 * rujukannya kalau barisnya hilang.
 */
export function AturTemplate({ id, nama, tingkatMin, tingkatMax, aktif, jenis }: {
  id: string
  nama: string
  tingkatMin: number
  tingkatMax: number
  aktif: boolean
  jenis: JenisRapor
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [isi, setIsi] = useState({ nama, tingkat_min: tingkatMin, tingkat_max: tingkatMax, aktif, jenis: jenis as string })

  function simpan(ubahan: Partial<typeof isi>) {
    const baru = { ...isi, ...ubahan }
    setIsi(baru)
    mulai(async () => {
      const hasil = await ubahTemplateAction(id, baru)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  function bacaUlang() {
    if (!confirm('Baca ulang berkas .docx-nya? Pemetaan medan akan disusun ulang dari tebakan baru dan perlu Anda periksa lagi.')) return
    mulai(async () => {
      const hasil = await bacaUlangTemplateAction(id)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success('Template dibaca ulang. Periksa pemetaannya.')
      router.refresh()
    })
  }

  function hapus() {
    if (!confirm('Hapus template ini? Rapor yang sudah diisi guru tidak ikut terhapus, tapi kehilangan bentuk lembarnya.')) return
    mulai(async () => {
      const hasil = await hapusTemplateAction(id)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success('Template dihapus.')
      router.push('/rapor-quran/template')
    })
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="atur-nama">Nama template</Label>
          <Input id="atur-nama" value={isi.nama} disabled={pending} className="h-10 md:h-9"
            onChange={e => setIsi({ ...isi, nama: e.target.value })}
            onBlur={e => e.target.value !== nama && simpan({ nama: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="atur-min">Dipakai kelas</Label>
          <div className="flex items-center gap-2">
            <Input id="atur-min" type="number" inputMode="numeric" min={1} max={12} value={isi.tingkat_min} disabled={pending}
              className="h-10 flex-1 text-center tabular-nums sm:w-16 sm:flex-none md:h-9"
              onChange={e => simpan({ tingkat_min: Number(e.target.value) })} />
            <span className="text-muted-foreground">–</span>
            <Input aria-label="Sampai kelas" type="number" inputMode="numeric" min={1} max={12} value={isi.tingkat_max} disabled={pending}
              className="h-10 flex-1 text-center tabular-nums sm:w-16 sm:flex-none md:h-9"
              onChange={e => simpan({ tingkat_max: Number(e.target.value) })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="atur-jenis">Jenis laporan</Label>
          <select id="atur-jenis" value={isi.jenis} disabled={pending} className={SELECT_NATIF}
            onChange={e => simpan({ jenis: e.target.value })}>
            {JENIS_RAPOR.map(j => <option key={j} value={j}>{LABEL_JENIS_RAPOR[j]}</option>)}
          </select>
        </div>

        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-primary/10 has-[:checked]:text-primary md:h-9 dark:has-[:checked]:bg-primary/20">
          <input type="checkbox" checked={isi.aktif} disabled={pending} onChange={e => simpan({ aktif: e.target.checked })} className="size-4 accent-primary" />
          {isi.aktif ? 'Aktif' : 'Nonaktif'}
        </label>
      </div>

      {/* Dipakai setelah penerjemah .docx diperbaiki: template lama tetap
          menyimpan hasil terjemahan lama sampai dibaca ulang. */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={bacaUlang} disabled={pending} className="flex-1 sm:flex-none">
          <RefreshCw /> Baca ulang berkas
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={hapus} disabled={pending}
          className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto sm:flex-none">
          <Trash2 /> Hapus
        </Button>
      </div>
    </div>
  )
}
