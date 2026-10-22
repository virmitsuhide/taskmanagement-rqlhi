'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tambahPesertaEkstraAction } from '@/app/actions/ekstra'
import { PilihSiswa } from '@/components/ekstra/PilihSiswa'
import { cn } from '@/lib/utils'

/**
 * Koordinator menambah peserta langsung ke halaqoh ini: siswa LHI dicari &
 * ditautkan ke data siswa (kelas dan wali terisi dari sana), non LHI cukup
 * diketik namanya. Kontak orang tua boleh dikosongkan.
 */
export function TambahPesertaEkstra({ slotId, sisa }: { slotId: string; sisa: number }) {
  const [pending, mulai] = useTransition()
  const [buka, setBuka] = useState(false)
  const [asal, setAsal] = useState<'lhi' | 'luar'>('lhi')
  const [siswa, setSiswa] = useState('')
  const [nama, setNama] = useState('')
  const [kelas, setKelas] = useState('')
  const [ortu, setOrtu] = useState('')
  const [wa, setWa] = useState('')

  const kosongkan = () => { setSiswa(''); setNama(''); setKelas(''); setOrtu(''); setWa('') }
  const siap = asal === 'lhi' ? !!siswa : nama.trim().length >= 3

  const simpan = () => mulai(async () => {
    const r = await tambahPesertaEkstraAction(slotId, {
      studentId: asal === 'lhi' ? siswa : null, namaAnak: nama, kelas, namaOrtu: ortu, waOrtu: wa,
    })
    if (r.error) { toast.error(r.error); return }
    toast.success('Peserta ditambahkan.')
    kosongkan()
    if (sisa <= 1) setBuka(false)
  })

  if (!buka) {
    return (
      <Button size="sm" onClick={() => setBuka(true)} disabled={sisa <= 0}>
        <UserPlus className="mr-1.5 h-4 w-4" />{sisa <= 0 ? 'Kuota penuh' : 'Tambah peserta'}
      </Button>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-xl border bg-muted/30 p-4">
      <div role="group" aria-label="Asal peserta" className="flex w-fit rounded-lg bg-muted p-1">
        {([['lhi', 'Siswa LHI'], ['luar', 'Non LHI']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setAsal(k); kosongkan() }} aria-pressed={asal === k}
            className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', asal === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {l}
          </button>
        ))}
      </div>

      {asal === 'lhi' ? (
        <div className="space-y-1">
          <PilihSiswa id={`tambah-${slotId}`} calon={[]} value={siswa} onChange={setSiswa} />
          <p className="text-[11px] text-muted-foreground">Ketik nama lalu Cari. Kelas dan kontak wali diambil dari data siswa bila kolom di bawah dikosongkan.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama peserta" aria-label="Nama peserta" maxLength={120} />
          <Input value={kelas} onChange={e => setKelas(e.target.value)} placeholder="Kelas / usia (opsional)" aria-label="Kelas" maxLength={40} />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={ortu} onChange={e => setOrtu(e.target.value)} placeholder="Nama orang tua (opsional)" aria-label="Nama orang tua" maxLength={120} />
        <Input value={wa} onChange={e => setWa(e.target.value)} placeholder="WA orang tua, 08… (opsional)" aria-label="WhatsApp orang tua" inputMode="tel" maxLength={20} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !siap} onClick={simpan}>{pending ? 'Menyimpan…' : 'Simpan peserta'}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setBuka(false); kosongkan() }}>Tutup</Button>
        <span className="ml-auto text-xs text-muted-foreground">sisa kursi {sisa}</span>
      </div>
    </div>
  )
}
