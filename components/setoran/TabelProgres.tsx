'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { updateSetoranAction } from '@/app/actions/setoran-koreksi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StarInput } from '@/components/setoran/StarInput'
import { cn } from '@/lib/utils'
import type { JenisRekap, ProgresSesi, SelProgres, SuntingSetoran } from '@/lib/data/rekap-sesi'

const HARI = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function tanggalPanjang(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function Sel({ isi, onSunting }: { isi: SelProgres[] | undefined; onSunting?: (s: SuntingSetoran) => void }) {
  if (!isi || isi.length === 0) return <span className="text-muted-foreground/40">·</span>
  return (
    <span className="flex flex-col items-center gap-0.5">
      {isi.map((s, i) => {
        const kelas = cn(
          'relative inline-flex min-w-8 justify-center rounded px-1 py-0.5 tabular-nums',
          s.ulang ? 'bg-warning-wash text-warning font-semibold' : 'bg-primary-wash text-primary',
          onSunting && 'cursor-pointer ring-primary/40 hover:ring-2',
        )
        const konten = (
          <>
            {s.label}
            {s.drill && <sup className="ml-0.5 text-[8px] font-bold">D</sup>}
            {s.adabRendah && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" aria-label="adab rendah" />
            )}
          </>
        )
        return onSunting ? (
          <button key={i} type="button" title={`${s.rinci}\n\nKlik untuk mengoreksi`} className={kelas} onClick={() => onSunting(s.sunting)}>
            {konten}
          </button>
        ) : (
          <span key={i} title={s.rinci} className={kelas}>{konten}</span>
        )
      })}
    </span>
  )
}

/**
 * Tabel progres siswa × hari sekolah — dipakai guru (baca saja) dan
 * koordinator (sel bisa diklik untuk dikoreksi).
 *
 * Koreksi tetap wewenang pengurus, bukan guru: riwayat capaian tidak boleh
 * bisa diubah diam-diam oleh orang yang nilainya sedang dinilai. Server
 * memeriksanya lagi per siswa (canManageSetoran) — prop `bisaSunting` hanya
 * soal menampilkan tombolnya.
 */
export function TabelProgres({
  data, jenis, hariIni, tautanSiswa, bisaSunting = false,
}: {
  data: ProgresSesi
  jenis: JenisRekap
  /** 'YYYY-MM-DD' WIB, dihitung di server supaya tidak berbeda saat hidrasi. */
  hariIni: string
  /** Awalan tautan nama siswa, mis. '/guru/siswa/' atau '/siswa/'. */
  tautanSiswa: string
  bisaSunting?: boolean
}) {
  const [sunting, setSunting] = useState<{ s: SuntingSetoran; nama: string } | null>(null)
  const adaSetoran = data.baris.some(b => b.jumlahHari > 0)

  return (
    <div className="rounded-xl border bg-card">
      {!adaSetoran && (
        <p className="border-b px-3 py-2 text-sm text-muted-foreground">
          Belum ada setoran {jenis} di sesi ini pada bulan tersebut.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-2 text-left font-medium">Siswa</th>
              {data.tanggal.map(t => {
                const d = new Date(`${t}T00:00:00`)
                return (
                  <th
                    key={t}
                    className={cn(
                      'px-1.5 py-2 text-center font-medium',
                      d.getDay() === 1 && 'border-l-2',
                      t === hariIni && 'bg-primary-wash text-primary',
                      t > hariIni && 'opacity-50',
                    )}
                  >
                    <span className="block text-[10px]">{HARI[d.getDay()]}</span>
                    <span className={cn('block text-sm tabular-nums', t === hariIni ? 'font-bold' : 'text-foreground')}>{d.getDate()}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.baris.map(b => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                  <Link href={`${tautanSiswa}${b.id}`} className="font-medium text-foreground hover:underline">
                    {b.nama}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {b.jumlahHari.toLocaleString('id-ID')} hari setor
                    {b.adabRendah > 0 && <span className="text-destructive"> · adab rendah {b.adabRendah}×</span>}
                  </span>
                  {b.akhir && (
                    <span className="block text-[11px] text-muted-foreground">
                      {b.awal && b.awal !== b.akhir ? `${b.awal} → ${b.akhir}` : b.akhir}
                    </span>
                  )}
                </td>
                {data.tanggal.map(t => (
                  <td
                    key={t}
                    className={cn(
                      'px-1.5 py-2 text-center align-middle',
                      new Date(`${t}T00:00:00`).getDay() === 1 && 'border-l-2',
                      t === hariIni && 'bg-primary-wash/40',
                    )}
                  >
                    <Sel isi={b.sel[t]} onSunting={bisaSunting ? s => setSunting({ s, nama: b.nama }) : undefined} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
        {jenis === 'tahsin' ? (
          <>
            <span><b className="text-primary">12</b> = halaman buku yang disetor</span>
            <span><b className="text-primary">Q45</b> = halaman mushaf</span>
            <span><b className="text-primary">D</b> = drill</span>
          </>
        ) : (
          <>
            <span><b className="text-primary">Z 6</b> = ziyadah 6 ayat</span>
            <span><b className="text-primary">MB</b> / <b className="text-primary">ML</b> = muroja&apos;ah baru / lama</span>
          </>
        )}
        <span><b className="text-warning">kuning</b> = ulang</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" /> adab ≤ 2,5★
        </span>
        {bisaSunting && (
          <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> klik sel untuk mengoreksi</span>
        )}
      </div>

      {sunting && (
        <DialogKoreksi key={sunting.s.id} s={sunting.s} nama={sunting.nama} onTutup={() => setSunting(null)} />
      )}
    </div>
  )
}

function DialogKoreksi({ s, nama, onTutup }: { s: SuntingSetoran; nama: string; onTutup: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'lulus' | 'ulang'>(s.status ?? 'lulus')
  /*
    Bintang hanya bisa menulis kelipatan lima; nilai lama seperti 88 tampil
    sebagai 4★ (= 90). Tanpa penanda ini, mengoreksi adab saja akan ikut
    mengubah nilai bacaan 88 → 90 tanpa ada yang memintanya. Nilai yang tidak
    disentuh dikirim ulang persis seperti aslinya.
  */
  const disentuh = useRef<Set<string>>(new Set())
  const tahsin = s.tabel === 'tahsin_logs'
  const namaNilai = tahsin ? 'nilai_tahsin' : 'nilai_tahfidz'

  function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (!disentuh.current.has(namaNilai)) fd.set(namaNilai, s.nilai === null ? '' : String(s.nilai))
    if (!disentuh.current.has('nilai_sikap')) fd.set('nilai_sikap', s.sikap === null ? '' : String(s.sikap))
    startTransition(async () => {
      const hasil = await updateSetoranAction(null, fd)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(tahsin ? 'Setoran dikoreksi — posisi siswa dihitung ulang.' : 'Setoran dikoreksi.')
      onTutup()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={buka => { if (!buka && !pending) onTutup() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Koreksi setoran{nama ? ` — ${nama}` : ''}</DialogTitle>
          <DialogDescription>
            {tanggalPanjang(s.tanggal)} · {s.judul}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={kirim} className="space-y-4">
          <input type="hidden" name="table" value={s.tabel} />
          <input type="hidden" name="id" value={s.id} />
          {/* Tanggal tidak dikoreksi di sini: memindahkannya bisa membuat dua setoran di satu hari. */}
          <input type="hidden" name="setoran_date" value={s.tanggal} />

          {tahsin ? (
            <>
              <input type="hidden" name="baris_dari" value={s.barisDari ?? ''} />
              <input type="hidden" name="baris_ke" value={s.barisKe ?? ''} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="k_halaman">Halaman</Label>
                  {s.halamanTerkunci ? (
                    <>
                      <input type="hidden" name="halaman" value={s.halaman ?? ''} />
                      <Input id="k_halaman" value={s.halaman ?? '—'} disabled />
                      <p className="text-[11px] text-muted-foreground">Mengikuti materi yang disetor.</p>
                    </>
                  ) : (
                    <Input id="k_halaman" name="halaman" type="number" min={1} defaultValue={s.halaman ?? ''} />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <input type="hidden" name="status" value={status} />
                  <div className="flex gap-1.5">
                    {(['lulus', 'ulang'] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStatus(v)}
                        aria-pressed={status === v}
                        className={cn(
                          'h-9 flex-1 rounded-md border text-sm transition-colors',
                          status === v
                            ? v === 'lulus' ? 'border-primary bg-primary-wash font-semibold text-primary' : 'border-warning bg-warning-wash font-semibold text-warning'
                            : 'bg-card hover:bg-accent',
                        )}
                      >
                        {v === 'lulus' ? 'Lulus' : 'Ulang'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="ayat_dari" value={s.ayatDari ?? ''} />
              <input type="hidden" name="ayat_ke" value={s.ayatKe ?? ''} />
            </>
          )}

          <div className="space-y-1.5">
            <Label>{tahsin ? 'Nilai bacaan' : 'Nilai hafalan'}</Label>
            <StarInput name={namaNilai} defaultValue={s.nilai} onChange={() => disentuh.current.add(namaNilai)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nilai adab</Label>
            <StarInput name="nilai_sikap" defaultValue={s.sikap} onChange={() => disentuh.current.add('nilai_sikap')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k_catatan">Catatan</Label>
            <Textarea id="k_catatan" name="catatan" rows={2} defaultValue={s.catatan ?? ''} />
          </div>

          {tahsin && (
            <p className="text-[11px] text-muted-foreground">
              Mengubah halaman atau status menghitung ulang posisi anak dari seluruh riwayat setorannya.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan koreksi'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
