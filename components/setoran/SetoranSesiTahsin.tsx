'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StarInput, harusMengulang } from '@/components/setoran/StarInput'
import { cn } from '@/lib/utils'
import { createTahsinLogSesiAction } from '@/app/actions/setoran'
import {
  BacaanQuranInput, BACAAN_KOSONG, keBacaanQuran, type IsianBacaan,
} from '@/components/setoran/BacaanQuranInput'
import { PilihMateri, type PilihanMateri } from '@/components/setoran/PilihMateri'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import type { SiswaSesiTahsin } from '@/lib/data/setoran-sesi'

interface Isian {
  dipilih: boolean
  /** Halaman BUKU. Tidak dipakai di tahap tak berbuku (Al-Qur'an, Talaqqi). */
  halaman: string
  /** Bacaan mushaf — hanya terisi di tahap yang baca_quran. */
  quran: IsianBacaan
  /** Materi yang disetor sesi ini — hanya di tahap Gharib/Tajwid. */
  materi: PilihanMateri
  nilai_tahsin: number | null
  nilai_sikap: number | null
  status: 'lulus' | 'ulang'
  catatan: string
  /** Dinaikkan setelah tersimpan supaya bintangnya ter-reset. */
  versi: number
  galat?: string
}

/**
 * Halaman buku dibiarkan kosong = pakai posisi anak saat ini. Posisinya dibaca
 * dari data server terbaru, jadi setelah tersimpan dan halaman dimuat ulang,
 * isian berikutnya otomatis menunjuk halaman yang baru.
 *
 * Bacaan mushaf justru DIISI DI MUKA dengan posisi terakhir anak. Bedanya
 * disengaja: halaman buku cuma satu angka yang gampang diketik ulang,
 * sedangkan bacaan mushaf butuh tiga — halaman, surat, ayat — dan mengetik
 * ketiganya dari nol untuk belasan anak tiap sesi adalah cara tercepat membuat
 * guru berhenti mengisinya sama sekali.
 */
/** Nama surat untuk baris keterangan; id yang tak dikenal tampil apa adanya. */
function namaSurat(surat: SuratPilihan[], id: number): string {
  return surat.find(x => x.id === id)?.name_latin ?? `Surat ${id}`
}

function isianAwal(s: SiswaSesiTahsin): Isian {
  return {
    dipilih: false, halaman: '',
    quran: s.baca_quran
      ? {
          halaman: s.quran.halaman ? String(s.quran.halaman) : '',
          surat_id: s.quran.surat_id ? String(s.quran.surat_id) : '',
          ayat_dari: s.quran.ayat ? String(s.quran.ayat) : '',
          ayat_ke: '',
        }
      : BACAAN_KOSONG,
    materi: {},
    nilai_tahsin: null, nilai_sikap: null, status: 'lulus', catatan: '', versi: 0,
  }
}

/**
 * Setoran tahsin untuk seluruh anak satu sesi dalam satu layar.
 *
 * Anak yang tidak dicentang tidak disimpan — tidak hadir atau tidak setor hari
 * itu tidak perlu tercatat sebagai apa pun. Aturannya sama persis dengan
 * setoran satu-satu (satu inti di server), termasuk drill di halaman terakhir.
 */
export function SetoranSesiTahsin({ siswa, surat }: { siswa: SiswaSesiTahsin[]; surat: SuratPilihan[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [isian, setIsian] = useState<Record<string, Isian>>(
    () => Object.fromEntries(siswa.map(s => [s.id, isianAwal(s)])),
  )

  const bisaDisetor = siswa.filter(s => s.jilid_id)
  const tanpaJilid = siswa.filter(s => !s.jilid_id)
  const jumlahDipilih = bisaDisetor.filter(s => isian[s.id]?.dipilih).length

  function ubah(id: string, perubahan: Partial<Isian>) {
    setIsian(prev => ({ ...prev, [id]: { ...prev[id], ...perubahan, galat: undefined } }))
  }

  function pilihSemua(nilai: boolean) {
    setIsian(prev => Object.fromEntries(
      Object.entries(prev).map(([id, v]) => [id, bisaDisetor.some(s => s.id === id) ? { ...v, dipilih: nilai } : v]),
    ))
  }

  function simpan() {
    const baris = bisaDisetor
      .filter(s => isian[s.id].dipilih)
      .map(s => {
        const v = isian[s.id]
        return {
          student_id: s.id,
          method_id: s.method_id,
          jilid_id: s.jilid_id,
          // Tahap tak berbuku tidak punya halaman buku sama sekali; yang
          // dikirim dari sana hanya bacaan mushafnya.
          // Tahap berbasis materi menurunkan halamannya sendiri di server.
          halaman: s.materi.length > 0 || s.total_halaman === null
            ? null
            : v.halaman ? Number(v.halaman) : s.halaman,
          quran: keBacaanQuran(v.quran),
          materi: Object.entries(v.materi).map(([materi_id, hasil]) => ({ materi_id, hasil })),
          nilai_tahsin: v.nilai_tahsin,
          nilai_sikap: v.nilai_sikap,
          status: v.status,
          catatan: v.catatan || null,
          setoran_date: tanggal,
        }
      })
    if (baris.length === 0) {
      toast.error('Centang minimal satu anak yang setor.')
      return
    }

    startTransition(async () => {
      const hasil = await createTahsinLogSesiAction(baris)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      const gagal = new Map(hasil.gagal.map(g => [g.student_id, g.pesan]))
      setIsian(prev => {
        const next = { ...prev }
        for (const b of baris) {
          next[b.student_id] = gagal.has(b.student_id)
            ? { ...prev[b.student_id], galat: gagal.get(b.student_id) }
            : { ...isianAwal(bisaDisetor.find(x => x.id === b.student_id)!), versi: prev[b.student_id].versi + 1 }
        }
        return next
      })
      if (hasil.tersimpan > 0) toast.success(`${hasil.tersimpan} setoran tersimpan.`)
      if (hasil.gagal.length > 0) toast.error(`${hasil.gagal.length} setoran belum tersimpan — lihat tanda merah.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="space-y-1">
          <label htmlFor="tanggal_sesi" className="text-xs font-medium">Tanggal setor</label>
          <Input id="tanggal_sesi" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => pilihSemua(true)}>Centang semua</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => pilihSemua(false)}>Kosongkan</Button>
        </div>
      </div>

      <ul className="space-y-2">
        {bisaDisetor.map(s => {
          const v = isian[s.id]
          const halamanTerakhir = s.total_halaman !== null && Number(v.halaman || s.halaman) >= s.total_halaman
          return (
            <li
              key={s.id}
              className={cn(
                'rounded-xl border bg-card p-3 transition-colors',
                v.dipilih && 'border-primary/60',
                v.galat && 'border-destructive',
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={v.dipilih}
                  onChange={e => ubah(s.id, { dipilih: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {s.full_name}
                    {s.drill_sejak && (
                      <span className="rounded-full bg-warning-wash px-1.5 py-px text-[10px] font-semibold text-warning">DRILL</span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.jilid_label}{s.total_halaman && s.halaman ? ` · hal. ${s.halaman}/${s.total_halaman}` : ''}
                    {s.baca_quran && s.quran.surat_id
                      ? ` · 📖 ${namaSurat(surat, s.quran.surat_id)}${s.quran.ayat ? `:${s.quran.ayat}` : ''}`
                      : ''}
                    {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                  </span>
                </span>
              </label>

              {v.dipilih && (
                <div className="mt-3 space-y-3 border-t pt-3 pl-7">
                  <div className="flex flex-wrap items-end gap-3">
                    {/*
                      Hanya tahap berbuku yang punya kolom ini. Di tahap Al-Qur'an
                      angka halaman yang dimaksud adalah halaman MUSHAF, dan itu
                      sudah punya kolomnya sendiri di bawah — dua kotak bernama
                      "Halaman" di satu kartu adalah undangan salah isi.
                    */}
                    {s.total_halaman !== null && s.materi.length === 0 && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium" htmlFor={`hal-${s.id}`}>
                          Hal. {s.jilid_label}{s.drill_sejak ? ' (drill)' : ''}
                        </label>
                        <Input
                          id={`hal-${s.id}`} type="number" inputMode="numeric" min={1}
                          max={s.total_halaman}
                          value={v.halaman}
                          placeholder={s.halaman ? String(s.halaman) : '—'}
                          onChange={e => ubah(s.id, { halaman: e.target.value })}
                          className="h-9 w-24"
                        />
                      </div>
                    )}
                    {/*
                      Tahap berbasis materi tidak punya status tunggal: tiap
                      materi punya hasilnya sendiri, dan menanyakan sekali lagi
                      di tingkat setoran hanya melahirkan jawaban yang bisa
                      bertentangan. Server menurunkannya dari materi.
                    */}
                    {s.materi.length === 0 && (
                    <div className="flex gap-1.5" role="group" aria-label="Status halaman">
                      {(['lulus', 'ulang'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => ubah(s.id, { status: st })}
                          aria-pressed={v.status === st}
                          className={cn(
                            'h-9 rounded-md border px-3 text-sm',
                            v.status === st
                              ? st === 'lulus' ? 'border-success bg-success-wash text-success' : 'border-warning bg-warning-wash text-warning'
                              : 'bg-card',
                          )}
                        >
                          {st === 'lulus' ? '✅ Lulus' : '🔁 Ulang'}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>

                  {s.materi.length > 0 && (
                    <div className="rounded-lg border p-2.5">
                      <p className="mb-1.5 text-xs font-semibold">
                        🧠 Hafalan {s.jilid_label}
                      </p>
                      <PilihMateri
                        materi={s.materi}
                        hasilTerakhir={s.materi_hasil}
                        value={v.materi}
                        onChange={m => ubah(s.id, { materi: m })}
                        disabled={pending}
                      />
                    </div>
                  )}

                  {s.baca_quran && (
                    <div className="rounded-lg border border-dashed p-2.5">
                      <p className="mb-1.5 text-xs font-semibold">
                        📖 Bacaan Al-Qur&rsquo;an
                        {s.total_halaman !== null && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            — berjalan bersama hafalan {s.jilid_label}
                          </span>
                        )}
                      </p>
                      <BacaanQuranInput
                        value={v.quran}
                        onChange={q => ubah(s.id, { quran: q })}
                        surat={surat}
                        disabled={pending}
                      />
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div key={`t-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai tahsin</p>
                      <StarInput
                        name={`nilai_tahsin_${s.id}`}
                        onChange={(b, n) => ubah(s.id, {
                          nilai_tahsin: b > 0 ? n : null,
                          ...(b > 0 ? { status: harusMengulang(b) ? 'ulang' : 'lulus' } : {}),
                        })}
                      />
                    </div>
                    <div key={`s-${v.versi}`}>
                      <p className="mb-1 text-xs font-medium">Nilai sikap</p>
                      <StarInput name={`nilai_sikap_${s.id}`} onChange={(b, n) => ubah(s.id, { nilai_sikap: b > 0 ? n : null })} />
                    </div>
                  </div>

                  <Input
                    placeholder="Catatan (opsional) — mis. baris yang dibaca, madd perlu dilatih…"
                    value={v.catatan}
                    onChange={e => ubah(s.id, { catatan: e.target.value })}
                    className="h-9"
                  />

                  {!s.drill_sejak && s.materi.length === 0 && v.status === 'lulus' && halamanTerakhir && (
                    <p className="text-xs text-primary">
                      🎯 Halaman terakhir — setelah disimpan anak masuk DRILL sampai lulus ujian tahsin.
                    </p>
                  )}
                  {v.galat && <p role="alert" className="text-xs font-medium text-destructive">{v.galat}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {tanpaJilid.length > 0 && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {tanpaJilid.length} anak belum punya jilid awal ({tanpaJilid.map(s => s.full_name.split(' ')[0]).join(', ')}).
          Setoran pertamanya lewat{' '}
          <Link href="/guru/setoran/tahsin/baru" className="text-primary hover:underline">setor satu-satu</Link>{' '}
          untuk menetapkan metode &amp; jilid.
        </p>
      )}

      {/* Tombol simpan menempel di bawah layar — satu sesi bisa belasan
          kartu, dan menggulung kembali ke atas hanya untuk menyimpan melelahkan. */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <Button type="button" size="lg" className="w-full" onClick={simpan} disabled={pending || jumlahDipilih === 0}>
          {pending ? 'Menyimpan…' : jumlahDipilih > 0 ? `Simpan ${jumlahDipilih} setoran` : 'Centang anak yang setor'}
        </Button>
      </div>
    </div>
  )
}
