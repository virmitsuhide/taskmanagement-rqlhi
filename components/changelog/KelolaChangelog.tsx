'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GitCommitHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  /** true = sedang menyunting draf dari commit (0128). */
  dariCommit?: boolean
  commitPesan?: string | null
}

const drafKosong = (hariIni: string, untuk: PembacaChangelog[]): Draf => ({ judul: '', isi: '', jenis: 'baru', untuk, tanggal: hariIni })

/** Baris pertama pesan commit. */
const subjekCommit = (pesan: string | null | undefined) => (pesan ?? '').replace(/^\uFEFF/, '').split('\n')[0]

/**
 * Layar tulis pembaruan untuk Kepala RQ. Satu entri boleh untuk beberapa
 * portal sekaligus; daftar di bawah form bisa disaring per pembaca dari
 * halamannya (?untuk=).
 */
export function KelolaChangelog({ daftar, drafCommit, hariIni, sekarang, pembacaAwal }: {
  daftar: EntriChangelog[]
  /** Draf yang masuk otomatis dari commit yang di-push, belum terbit. */
  drafCommit: EntriChangelog[]
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

  async function simpan(terbitkan?: boolean) {
    setProses(true)
    try {
      const hasil = await simpanChangelogAction({ ...draf, terbitkan: draf.dariCommit ? terbitkan : undefined })
      if (hasil.error) { toast.error(hasil.error); return }
      toast.success(draf.dariCommit ? (terbitkan ? 'Draf diterbitkan.' : 'Draf disimpan.') : draf.id ? 'Pembaruan diperbarui.' : 'Pembaruan diterbitkan.')
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
    const dariCommit = e.status === 'draf'
    setDraf({
      id: e.id, judul: e.judul, isi: e.isi, jenis: e.jenis, untuk: e.untuk,
      // Draf terbit pada hari diterbitkan, bukan hari commit-nya.
      tanggal: dariCommit ? hariIni : tanggalWIB(e.terbit_at),
      dariCommit, commitPesan: e.commit_pesan,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const tombolHapus = (id: string, label: string, tanya: string) => hapusId === id ? (
    <>
      <span className="text-xs text-muted-foreground">{tanya}</span>
      <Button type="button" size="sm" variant="destructive" onClick={() => hapus(id)} disabled={proses}>Ya, {label.toLowerCase()}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setHapusId(null)} disabled={proses}>Tidak</Button>
    </>
  ) : (
    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setHapusId(id)} disabled={proses}>
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />{label}
    </Button>
  )

  return (
    <div className="space-y-5">
      {drafCommit.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-warning/40 bg-warning/5 p-4">
          <div>
            <h2 className="text-sm font-semibold">Draf dari sistem · {drafCommit.length}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Masuk otomatis setiap ada perubahan sistem. Belum terlihat siapa pun — periksa bahasanya, pilih pembacanya, lalu terbitkan.
              Perubahan yang tidak perlu dikabarkan cukup dibuang.
            </p>
          </div>
          <ol className="space-y-2">
            {drafCommit.map(e => (
              <li key={e.id} className={`rounded-xl border bg-card p-3 ${draf.id === e.id ? 'ring-2 ring-primary' : ''}`}>
                <IsiChangelog e={e} tampilPembaca />
                {!e.isi && <p className="mt-1.5 text-xs font-medium text-warning">Belum ada penjelasan sederhana — tulis isinya sebelum terbit.</p>}
                {e.commit_pesan && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      <GitCommitHorizontal className="mr-1 inline h-3.5 w-3.5" aria-hidden />Catatan teknis asli
                    </summary>
                    <pre className="mt-1.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">{e.commit_pesan}</pre>
                  </details>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
                  <Button type="button" size="sm" onClick={() => sunting(e)} disabled={proses}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />Tinjau & terbitkan
                  </Button>
                  {tombolHapus(e.id, 'Buang', 'Buang draf ini?')}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">{draf.dariCommit ? 'Tinjau draf dari sistem' : draf.id ? 'Sunting pembaruan' : 'Tulis pembaruan'}</h2>
        {draf.dariCommit && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Dari: <span className="font-mono">{subjekCommit(draf.commitPesan)}</span>
          </p>
        )}

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
          <Button type="button" onClick={() => simpan(true)} disabled={proses || !draf.judul.trim() || draf.untuk.length === 0}>
            {proses ? 'Menyimpan…' : draf.dariCommit ? 'Terbitkan' : draf.id ? 'Simpan perubahan' : 'Terbitkan'}
          </Button>
          {draf.dariCommit && (
            <Button type="button" variant="outline" onClick={() => simpan(false)} disabled={proses || !draf.judul.trim() || draf.untuk.length === 0}>
              Simpan sebagai draf
            </Button>
          )}
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
                  {tombolHapus(e.id, 'Hapus', 'Hapus pembaruan ini?')}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
