'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hapusPanduanAction, mintaUnggahPanduanAction, simpanPanduanAction } from '@/app/actions/panduan-guru'
import { BUCKET_PANDUAN, LABEL_KATEGORI_PANDUAN, MAKS_UKURAN_PANDUAN, URUTAN_KATEGORI_PANDUAN, type KategoriPanduan } from '@/lib/rq/panduan-guru'

const KELAS_INPUT = 'h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Unggah satu PDF panduan. Tiga langkah: minta tautan unggah ke server
 * (izin diperiksa di sana), kirim berkas langsung ke storage, lalu catat
 * dokumennya. Sasaran pembacanya ditentukan server dari peran pengunggah.
 */
export function FormUnggahPanduan({ labelSasaran }: { labelSasaran: string }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [judul, setJudul] = useState('')
  const [kategori, setKategori] = useState<KategoriPanduan>('sop_pembelajaran')
  const [keterangan, setKeterangan] = useState('')
  const [berkas, setBerkas] = useState<File | null>(null)
  const inputBerkas = useRef<HTMLInputElement>(null)

  function unggah(e: React.FormEvent) {
    e.preventDefault()
    if (!berkas) { toast.error('Pilih berkas PDF.'); return }
    if (berkas.size > MAKS_UKURAN_PANDUAN) { toast.error('Ukuran PDF maksimal 25 MB.'); return }
    mulai(async () => {
      const izin = await mintaUnggahPanduanAction(berkas.name, berkas.size, berkas.type)
      if (izin.error || !izin.path || !izin.token) { toast.error(izin.error ?? 'Gagal menyiapkan unggahan.'); return }

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error: galat } = await supabase.storage.from(BUCKET_PANDUAN)
        .uploadToSignedUrl(izin.path, izin.token, berkas, { contentType: 'application/pdf' })
      if (galat) { toast.error('Gagal mengunggah berkas. Periksa koneksi lalu coba lagi.'); return }

      const r = await simpanPanduanAction({ judul: judul || berkas.name.replace(/\.pdf$/i, ''), kategori, keterangan, path: izin.path, namaBerkas: berkas.name, ukuran: berkas.size })
      if (r.error) { toast.error(r.error); return }
      toast.success('Panduan terunggah.')
      setJudul(''); setKeterangan(''); setBerkas(null)
      if (inputBerkas.current) inputBerkas.current.value = ''
      router.refresh()
    })
  }

  return (
    <form onSubmit={unggah} className="space-y-3">
      <p className="text-xs text-muted-foreground">Dibaca oleh: <b className="text-foreground">{labelSasaran}</b></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="judul-panduan">Judul</Label>
          <Input id="judul-panduan" value={judul} onChange={e => setJudul(e.target.value)} placeholder="mis. SOP Cuti Guru" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kategori-panduan">Kategori</Label>
          <select id="kategori-panduan" value={kategori} onChange={e => setKategori(e.target.value as KategoriPanduan)} className={KELAS_INPUT}>
            {URUTAN_KATEGORI_PANDUAN.map(k => <option key={k} value={k}>{LABEL_KATEGORI_PANDUAN[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="keterangan-panduan">Keterangan <span className="font-normal text-muted-foreground">(opsional)</span></Label>
        <Input id="keterangan-panduan" value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="mis. Berlaku mulai Juli 2026" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="berkas-panduan">Berkas PDF <span className="font-normal text-muted-foreground">(maks. 25 MB)</span></Label>
        <input ref={inputBerkas} id="berkas-panduan" type="file" accept="application/pdf,.pdf"
          onChange={e => setBerkas(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:text-sm" />
      </div>
      <Button type="submit" disabled={pending || !berkas}>
        <Upload className="mr-1.5 h-4 w-4" />{pending ? 'Mengunggah…' : 'Unggah'}
      </Button>
    </form>
  )
}

export function TombolHapusPanduan({ id, judul }: { id: string; judul: string }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  return (
    <Button
      type="button" variant="ghost" size="sm" disabled={pending}
      className="text-destructive" aria-label={`Hapus ${judul}`}
      onClick={() => {
        if (!confirm(`Hapus "${judul}"? Guru tidak bisa membacanya lagi.`)) return
        mulai(async () => {
          const r = await hapusPanduanAction(id)
          if (r.error) { toast.error(r.error); return }
          toast.success('Dokumen dihapus.')
          router.refresh()
        })
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
