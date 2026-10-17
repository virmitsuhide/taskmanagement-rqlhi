'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { hapusChangelogAction, simpanChangelogAction } from '@/app/actions/changelog'
import {
  LABEL_JENIS, LABEL_PEMBACA, URUTAN_JENIS, URUTAN_PEMBACA,
  type EntriChangelog, type JenisChangelog, type PembacaChangelog,
} from '@/lib/rq/changelog'
import { IsiChangelog } from './DaftarChangelog'

const SELECT = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** 'YYYY-MM-DD' menurut WIB. */
const tanggalWIB = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso))

interface Draf {
  id?: string
  judul: string
  isi: string
  jenis: JenisChangelog
  untuk: PembacaChangelog[]
  tanggal: string
}

const drafKosong = (hariIni: string, untuk: PembacaChangelog[]): Draf => ({ judul: '', isi: '', jenis: 'baru', untuk, tanggal: hariIni })

/**
 * Layar tulis pembaruan untuk Kepala RQ. Satu entri boleh untuk beberapa
 * portal sekaligus; daftar di bawah form bisa disaring per pembaca dari
 * halamannya (?untuk=).
 */
export function KelolaChangelog({ daftar, hariIni, sekarang, pembacaAwal }: {
  daftar: EntriChangelog[]
  hariIni: string
  /** ISO waktu server — pembeda entri yang dijadwalkan terbit nanti. */
  sekarang: string
  /** Pembaca yang dicentang di form baru — mengikuti saringan yang sedang dibuka. */
  pembacaAwal: PembacaChangelog[]
}) {
  const router = useRouter()
  const [draf, setDraf] = useState<Draf>(() => drafKosong(hariIni, pembacaAwal))
  const [proses, setProses] = useState(false)
  const [hapusId, setHapusId] = useState<string | null>(null)
  const ubah = (sebagian: Partial<Draf>) => setDraf(d => ({ ...d, ...sebagian }))

  async function simpan() {
    setProses(true)
    try {
      const hasil = await simpanChangelogAction(draf)
      if (hasil.error) { toast.error(hasil.error); return }
      toast.success(draf.id ? 'Pembaruan diperbarui.' : 'Pembaruan diterbitkan.')
      setDraf(drafKosong(hariIni, pembacaAwal))
      router.refresh()
    } finally {
      setProses(false)
    }
  }

  async function hapus(id: string) {
    setProses(true)
    try {
      const hasil = await hapusChangelogAction(id)
      if (hasil.error) { toast.error(hasil.error); return }
      toast.success('Pembaruan dihapus.')
      if (draf.id === id) setDraf(drafKosong(hariIni, pembacaAwal))
      setHapusId(null)
      router.refresh()
    } finally {
      setProses(false)
    }
  }

  const sunting = (e: EntriChangelog) => {
    setDraf({ id: e.id, judul: e.judul, isi: e.isi, jenis: e.jenis, untuk: e.untuk, tanggal: tanggalWIB(e.terbit_at) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">{draf.id ? 'Sunting pembaruan' : 'Tulis pembaruan'}</h2>

        <div className="space-y-1.5">
          <Label htmlFor="judul">Judul</Label>
          <Input id="judul" className="h-9" value={draf.judul} maxLength={200}
            onChange={e => ubah({ judul: e.target.value })} placeholder="mis. Laporan orang tua TPAIT kini berformat Fun Qur'an" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="jenis">Jenis</Label>
            <select id="jenis" className={SELECT} value={draf.jenis} onChange={e => ubah({ jenis: e.target.value as JenisChangelog })}>
              {URUTAN_JENIS.map(j => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tanggal">Tanggal terbit</Label>
            <Input id="tanggal" type="date" className="h-9" value={draf.tanggal} onChange={e => ubah({ tanggal: e.target.value })} />
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Untuk</legend>
          <div className="flex flex-wrap gap-2">
            {URUTAN_PEMBACA.map(p => {
              const aktif = draf.untuk.includes(p)
              return (
                <label key={p} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm select-none has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="checkbox" checked={aktif} className="h-4 w-4 accent-[var(--primary)]"
                    onChange={() => ubah({ untuk: aktif ? draf.untuk.filter(x => x !== p) : [...draf.untuk, p] })} />
                  {LABEL_PEMBACA[p]}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">Pengurus membaca di dashboard, guru di portal guru, karyawan di portal karyawan.</p>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="isi">Isi</Label>
          <Textarea id="isi" rows={6} value={draf.isi} maxLength={5000} onChange={e => ubah({ isi: e.target.value })}
            placeholder={'Apa yang berubah dan di mana menemukannya.\n- poin pakai tanda minus\n**tebal** untuk penekanan'} />
          <p className="text-xs text-muted-foreground">Mendukung daftar (<code>-</code> / <code>1.</code>), <b>**tebal**</b>, dan <i>*miring*</i>.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={simpan} disabled={proses || !draf.judul.trim() || draf.untuk.length === 0}>
            {proses ? 'Menyimpan…' : draf.id ? 'Simpan perubahan' : 'Terbitkan'}
          </Button>
          {draf.id && (
            <Button type="button" variant="outline" onClick={() => setDraf(drafKosong(hariIni, pembacaAwal))} disabled={proses}>Batal sunting</Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Semua pembaruan</h2>
        {daftar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembaruan untuk pembaca ini.</p>
        ) : (
          <ol className="space-y-3">
            {daftar.map(e => (
              <li key={e.id} className="rounded-2xl border bg-card p-4">
                <IsiChangelog e={e} tampilPembaca akanTerbit={e.terbit_at > sekarang} />
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => sunting(e)} disabled={proses}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />Sunting
                  </Button>
                  {hapusId === e.id ? (
                    <>
                      <span className="text-xs text-muted-foreground">Hapus pembaruan ini?</span>
                      <Button type="button" size="sm" variant="destructive" onClick={() => hapus(e.id)} disabled={proses}>Ya, hapus</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setHapusId(null)} disabled={proses}>Tidak</Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setHapusId(e.id)} disabled={proses}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Hapus
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
