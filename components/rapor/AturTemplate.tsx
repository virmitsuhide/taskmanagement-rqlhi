'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hapusTemplateAction, ubahTemplateAction } from '@/app/actions/rapor-template'

/**
 * Pengaturan template: nama, kelas berapa yang memakainya, aktif/tidak.
 *
 * Menonaktifkan lebih dipilih daripada menghapus: rapor yang sudah dicetak
 * semester lalu menunjuk template ini, dan daftar isian guru ikut kehilangan
 * rujukannya kalau barisnya hilang.
 */
export function AturTemplate({ id, nama, tingkatMin, tingkatMax, aktif }: {
  id: string
  nama: string
  tingkatMin: number
  tingkatMax: number
  aktif: boolean
}) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [isi, setIsi] = useState({ nama, tingkat_min: tingkatMin, tingkat_max: tingkatMax, aktif })

  function simpan(ubahan: Partial<typeof isi>) {
    const baru = { ...isi, ...ubahan }
    setIsi(baru)
    mulai(async () => {
      const hasil = await ubahTemplateAction(id, baru)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
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
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-[200px] flex-1 space-y-1">
        <label className="text-xs font-medium" htmlFor="atur-nama">Nama template</label>
        <Input id="atur-nama" value={isi.nama} disabled={pending} className="h-9"
          onChange={e => setIsi({ ...isi, nama: e.target.value })}
          onBlur={e => e.target.value !== nama && simpan({ nama: e.target.value })} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="atur-min">Dipakai kelas</label>
        <div className="flex items-center gap-2">
          <Input id="atur-min" type="number" min={1} max={12} value={isi.tingkat_min} disabled={pending} className="h-9 w-20"
            onChange={e => simpan({ tingkat_min: Number(e.target.value) })} />
          <span className="text-muted-foreground">–</span>
          <Input type="number" min={1} max={12} value={isi.tingkat_max} disabled={pending} className="h-9 w-20"
            onChange={e => simpan({ tingkat_max: Number(e.target.value) })} />
        </div>
      </div>

      <label className="flex h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={isi.aktif} disabled={pending} onChange={e => simpan({ aktif: e.target.checked })} />
        Aktif
      </label>

      <Button type="button" variant="outline" size="sm" onClick={hapus} disabled={pending} className="ml-auto">
        <Trash2 /> Hapus
      </Button>
    </div>
  )
}
