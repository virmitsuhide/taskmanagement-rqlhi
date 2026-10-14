'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { simpanMateriEkstraAction } from '@/app/actions/ekstra'

/**
 * Setor materi pertemuan ekstra bidang 'materi' (Bahasa Arab, pelatihan guru).
 * Satu deskripsi per pertemuan; mengosongkan lalu menyimpan = menghapus.
 */
export function FormMateriEkstra({ slotId, tanggal, awal }: { slotId: string; tanggal: string; awal: string }) {
  const [isi, setIsi] = useState(awal)
  const [pending, mulai] = useTransition()
  const berubah = isi.trim() !== awal.trim()

  return (
    <form
      className="space-y-2"
      onSubmit={e => {
        e.preventDefault()
        mulai(async () => {
          const h = await simpanMateriEkstraAction(slotId, tanggal, isi)
          if (h.error) toast.error(h.error)
          else toast.success(isi.trim() ? 'Materi tersimpan' : 'Materi dihapus')
        })
      }}
    >
      <label htmlFor="materi" className="text-xs font-semibold">Materi yang diberikan</label>
      <Textarea
        id="materi"
        rows={4}
        maxLength={2000}
        value={isi}
        onChange={e => setIsi(e.target.value)}
        placeholder="mis. Mufrodat anggota tubuh; percakapan perkenalan (ta'aruf); latihan menulis huruf sambung."
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !berubah}>
          {pending ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Setor materi'}
        </Button>
        {awal && <span className="text-xs text-muted-foreground">Sudah tercatat — kosongkan lalu simpan untuk menghapus.</span>}
      </div>
    </form>
  )
}
