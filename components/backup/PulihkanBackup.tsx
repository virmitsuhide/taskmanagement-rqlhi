'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileArchive, Loader2, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  batalPemulihan, mulaiPemulihan, simulasiPemulihan, terapkanPemulihan, unggahBagian,
  type HasilPemulihan, type MetaBerkas,
} from '@/app/actions/pulihkan'

/**
 * Berkas dibuka & diperiksa di peramban, lalu dikirim per potongan: berkas
 * "semua" bisa puluhan MB setelah dibuka, sedangkan satu kiriman ke server
 * dibatasi 4 MB (next.config serverActions.bodySizeLimit).
 */
const BATAS_POTONGAN = 1_500_000

interface BerkasBackup {
  meta: { aplikasi?: string; bidang?: string; judul?: string; dibuat?: string; oleh?: string }
  tables: Record<string, unknown[]>
  ringkasan?: { jumlah_baris?: Record<string, number>; galat?: Record<string, string> }
}

interface Terbaca {
  nama: string
  meta: BerkasBackup['meta']
  tables: Record<string, unknown[]>
  peringatan: string[]
}

type Tahap =
  | { k: 'pilih' }
  | { k: 'siap'; berkas: Terbaca }
  | { k: 'unggah'; berkas: Terbaca; persen: number }
  | { k: 'simulasi'; berkas: Terbaca; sesi: string; hasil: HasilPemulihan }
  | { k: 'selesai'; hasil: HasilPemulihan }

const FORMAT = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })

/**
 * Peringatan bila backup yang akan dipulihkan sudah lama. Semua yang
 * dikerjakan sejak tanggal itu akan hilang dari tabel-tabel di berkas.
 *
 * Kembalikan teks peringatan, atau null bila tidak perlu diperingatkan.
 */
function peringatanUsia(dibuat: Date, sekarang: Date): string | null {
  // TODO: tentukan batasnya
  void dibuat; void sekarang
  return null
}

async function bacaBerkas(file: File): Promise<Terbaca> {
  const teks = file.name.endsWith('.gz')
    ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : await file.text()

  let isi: BerkasBackup
  try {
    isi = JSON.parse(teks)
  } catch {
    throw new Error('Berkas rusak atau terpotong — isinya bukan JSON utuh.')
  }
  if (isi?.meta?.aplikasi !== 'RQ LHI Management System' || typeof isi.tables !== 'object') {
    throw new Error('Ini bukan berkas backup RQ LHI.')
  }
  // Ringkasan ditulis paling akhir: tanpa ringkasan berarti unduhannya
  // terputus di tengah, dan tabel terakhir di berkas tidak lengkap.
  if (!isi.ringkasan?.jumlah_baris) {
    throw new Error('Berkas tidak lengkap (ringkasan di akhir berkas tidak ada) — unduhan backup ini terputus.')
  }

  const peringatan: string[] = []
  const tables: Record<string, unknown[]> = {}
  const galat = isi.ringkasan.galat ?? {}
  for (const [t, baris] of Object.entries(isi.tables)) {
    // Tabel yang gagal dibaca saat backup tercatat sebagai daftar kosong.
    // Memulihkannya berarti MENGHAPUS seluruh isinya — jadi dilewati.
    if (galat[t]) { peringatan.push(`Tabel ${t} gagal dibaca saat backup dibuat — dilewati, isinya sekarang tidak diubah.`); continue }
    if (!Array.isArray(baris) || baris.length !== isi.ringkasan.jumlah_baris[t]) {
      throw new Error(`Jumlah baris tabel ${t} tidak cocok dengan ringkasan — berkas rusak.`)
    }
    tables[t] = baris
  }
  if (isi.meta.dibuat) {
    const usia = peringatanUsia(new Date(isi.meta.dibuat), new Date())
    if (usia) peringatan.unshift(usia)
  }
  return { nama: file.name, meta: isi.meta, tables, peringatan }
}

/** Potong baris satu tabel menjadi kiriman ≤ BATAS_POTONGAN. Tabel kosong tetap satu potongan. */
function potong(baris: unknown[]): unknown[][] {
  const hasil: unknown[][] = []
  let kini: unknown[] = []
  let ukuran = 0
  for (const b of baris) {
    const n = JSON.stringify(b).length
    if (kini.length && ukuran + n > BATAS_POTONGAN) { hasil.push(kini); kini = []; ukuran = 0 }
    kini.push(b); ukuran += n
  }
  hasil.push(kini)
  return hasil
}

export function PulihkanBackup() {
  const [tahap, setTahap] = useState<Tahap>({ k: 'pilih' })
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [sudahBackup, setSudahBackup] = useState(false)
  const [konfirmasi, setKonfirmasi] = useState('')

  function ulang() {
    if (tahap.k === 'simulasi') void batalPemulihan(tahap.sesi)
    setTahap({ k: 'pilih' }); setGalat(null); setSudahBackup(false); setKonfirmasi('')
  }

  async function pilih(file: File | undefined) {
    if (!file) return
    setGalat(null); setSibuk(true)
    try {
      setTahap({ k: 'siap', berkas: await bacaBerkas(file) })
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  async function unggahDanSimulasikan(berkas: Terbaca) {
    setGalat(null)
    setTahap({ k: 'unggah', berkas, persen: 0 })
    try {
      const mulai = await mulaiPemulihan()
      if (!mulai.success) throw new Error(mulai.error)
      const { sesi } = mulai.data

      const kiriman = Object.entries(berkas.tables).flatMap(([t, baris]) =>
        potong(baris).map((isi, bagian) => ({ t, bagian, isi })))
      for (const [i, k] of kiriman.entries()) {
        const r = await unggahBagian(sesi, k.t, k.bagian, k.isi)
        if (!r.success) throw new Error(r.error)
        setTahap({ k: 'unggah', berkas, persen: Math.round(((i + 1) / kiriman.length) * 100) })
      }

      const sim = await simulasiPemulihan(sesi)
      if (!sim.success) throw new Error(sim.error)
      if (!sim.data.ok) {
        void batalPemulihan(sesi)
        throw new Error(`Simulasi gagal${sim.data.tabel_galat ? ` di tabel ${sim.data.tabel_galat}` : ''}: ${sim.data.galat}. Tidak ada data yang berubah.`)
      }
      setTahap({ k: 'simulasi', berkas, sesi, hasil: sim.data })
    } catch (e) {
      setGalat((e as Error).message)
      setTahap({ k: 'siap', berkas })
    }
  }

  async function terapkan(sesi: string, berkas: Terbaca) {
    setGalat(null); setSibuk(true)
    const meta: MetaBerkas = { berkas: berkas.nama, bidang: berkas.meta.bidang ?? '', dibuat: berkas.meta.dibuat ?? '' }
    try {
      const r = await terapkanPemulihan(sesi, meta, konfirmasi)
      if (!r.success) throw new Error(r.error)
      if (!r.data.ok) throw new Error(`Pemulihan dibatalkan${r.data.tabel_galat ? ` di tabel ${r.data.tabel_galat}` : ''}: ${r.data.galat}. Tidak ada data yang berubah.`)
      setTahap({ k: 'selesai', hasil: r.data })
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-4">
      {galat && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 break-words">{galat}</p>
        </div>
      )}

      {tahap.k === 'pilih' && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-card px-4 py-10 text-center transition-colors hover:bg-muted/40">
          {sibuk ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <span className="text-sm font-medium">{sibuk ? 'Membuka berkas…' : 'Pilih berkas backup (.json.gz)'}</span>
          <span className="text-xs text-muted-foreground">Berkas dibuka & diperiksa di perangkat ini dulu.</span>
          <input
            type="file"
            accept=".gz,.json,application/gzip,application/json"
            className="sr-only"
            disabled={sibuk}
            onChange={e => { void pilih(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
      )}

      {(tahap.k === 'siap' || tahap.k === 'unggah') && (
        <section className="rounded-2xl border bg-card p-4 space-y-3">
          <RingkasanBerkas berkas={tahap.berkas} />
          {tahap.k === 'unggah' ? (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{tahap.persen < 100 ? 'Mengunggah…' : 'Menyimulasikan…'}</span>
                <span>{tahap.persen}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${tahap.persen}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => unggahDanSimulasikan(tahap.berkas)}>
                <Upload /> Unggah & simulasikan
              </Button>
              <Button variant="ghost" onClick={ulang}>Pilih berkas lain</Button>
            </div>
          )}
        </section>
      )}

      {tahap.k === 'simulasi' && (
        <section className="rounded-2xl border bg-card p-4 space-y-4">
          <RingkasanBerkas berkas={tahap.berkas} />
          <TabelHasil hasil={tahap.hasil} judul="Hasil simulasi — belum ada yang berubah" />

          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm">
              Semua perubahan pada tabel di atas sejak backup dibuat akan <b>hilang</b>. Unduh dulu backup
              terbaru supaya keadaan sekarang masih bisa dikembalikan bila ternyata keliru.
            </p>
            <a href="/backup/semua" download className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Unduh backup seluruh basis data sekarang
            </a>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={sudahBackup} onChange={e => setSudahBackup(e.target.checked)} />
              Saya sudah menyimpan backup terbaru.
            </label>
            <label className="block text-sm">
              Ketik <b>PULIHKAN</b> untuk mengonfirmasi
              <Input className="mt-1 max-w-xs" value={konfirmasi} onChange={e => setKonfirmasi(e.target.value)} autoComplete="off" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={sibuk || !sudahBackup || konfirmasi.trim().toUpperCase() !== 'PULIHKAN'}
                onClick={() => terapkan(tahap.sesi, tahap.berkas)}
              >
                {sibuk ? <Loader2 className="animate-spin" /> : <RotateCcw />} Terapkan pemulihan
              </Button>
              <Button variant="ghost" disabled={sibuk} onClick={ulang}>Batal</Button>
            </div>
          </div>
        </section>
      )}

      {tahap.k === 'selesai' && (
        <section className="rounded-2xl border bg-card p-4 space-y-4">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="h-5 w-5" /> Data berhasil dipulihkan.
          </p>
          <TabelHasil hasil={tahap.hasil} judul="Yang diterapkan" />
          <Button variant="outline" onClick={ulang}>Selesai</Button>
        </section>
      )}
    </div>
  )
}

function RingkasanBerkas({ berkas }: { berkas: Terbaca }) {
  const total = Object.values(berkas.tables).reduce((s, b) => s + b.length, 0)
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileArchive className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="break-all font-medium">{berkas.nama}</p>
          <p className="text-xs text-muted-foreground">
            {berkas.meta.judul ?? berkas.meta.bidang}
            {berkas.meta.dibuat && <> · dibuat {FORMAT.format(new Date(berkas.meta.dibuat))}</>}
            {berkas.meta.oleh && <> oleh {berkas.meta.oleh}</>}
            {' · '}{Object.keys(berkas.tables).length} tabel, {total.toLocaleString('id-ID')} baris
          </p>
        </div>
      </div>
      {berkas.peringatan.map(p => (
        <p key={p} className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {p}
        </p>
      ))}
    </div>
  )
}

function TabelHasil({ hasil, judul }: { hasil: HasilPemulihan; judul: string }) {
  const baris = Object.entries(hasil.tabel ?? {})
  const berubah = baris
    .filter(([, h]) => h.baru + h.berubah + h.dihapus > 0)
    .sort(([, a], [, b]) => (b.baru + b.berubah + b.dihapus) - (a.baru + a.berubah + a.dihapus))
  const luar = Object.entries(hasil.luar ?? {})

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-lg font-medium">{judul}</h2>
      {berubah.length === 0 ? (
        <p className="text-sm text-muted-foreground">Semua tabel sudah sama dengan isi berkas — tidak ada yang perlu diubah.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Tabel</th>
                <th className="py-1 px-2 text-right font-medium">Kembali</th>
                <th className="py-1 px-2 text-right font-medium">Diubah</th>
                <th className="py-1 pl-2 text-right font-medium">Dihapus</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {berubah.map(([t, h]) => (
                <tr key={t}>
                  <td className="py-1 pr-3 font-mono text-xs">{t}</td>
                  <td className="py-1 px-2 text-right">{h.baru || '–'}</td>
                  <td className="py-1 px-2 text-right">{h.berubah || '–'}</td>
                  <td className={`py-1 pl-2 text-right ${h.dihapus ? 'font-semibold text-destructive' : ''}`}>{h.dihapus || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {baris.length - berubah.length} tabel lain sudah sama. <b>Kembali</b> = baris yang terhapus sejak backup
        dan akan dibuat lagi; <b>Dihapus</b> = baris yang dibuat sejak backup.
      </p>
      {luar.length > 0 && (
        <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs">
          <p className="font-medium">Ikut berubah di tabel yang tidak ada di berkas (karena terhubung):</p>
          <ul className="mt-1 space-y-0.5">
            {luar.map(([t, n]) => (
              <li key={t}><span className="font-mono">{t}</span>: {n.sebelum} → {n.sesudah} baris</li>
            ))}
          </ul>
        </div>
      )}
      {(hasil.dilewati?.length ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          Dilewati (tabelnya sudah tidak ada di sistem): {hasil.dilewati!.join(', ')}
        </p>
      )}
      {['users', 'teachers', 'employees'].some(t => (hasil.tabel?.[t]?.baru ?? 0) > 0) && (
        <p className="text-xs text-muted-foreground">
          Akun yang kembali tidak punya sandi — atur ulang sandinya lewat Akun & Password.
        </p>
      )}
    </div>
  )
}
