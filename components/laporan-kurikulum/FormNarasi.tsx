'use client'

import { useState, useTransition } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simpanNarasiLaporanAction } from '@/app/actions/laporan-kurikulum'
import type { BarisMasalah, NarasiLaporan, SubBab } from '@/lib/data/laporan-kurikulum'

const KOSONG = { analisis: '', masalah: '', rekomendasi: '' }

/**
 * Isian narasi Kumik. Draf otomatis sudah terisi saat laporan dibuat;
 * Kumik menyunting, menambah identifikasi masalah & rekomendasi, dan
 * menulis kesimpulan. Satu tombol simpan untuk seluruh isian.
 */
export function FormNarasi({ periode, awal, sub, nomorMasalah, bisaUbah }: {
  periode: string
  awal: NarasiLaporan
  sub: SubBab[]
  nomorMasalah: string
  bisaUbah: boolean
}) {
  const [n, setN] = useState<NarasiLaporan>(awal)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [berubah, setBerubah] = useState(false)
  const [pending, mulai] = useTransition()

  const ubah = (patch: Partial<NarasiLaporan>) => { setN(x => ({ ...x, ...patch })); setBerubah(true); setPesan(null) }
  const ubahAnalisis = (kunci: string, bagian: keyof typeof KOSONG, nilai: string) =>
    ubah({ analisis: { ...n.analisis, [kunci]: { ...(n.analisis[kunci] ?? KOSONG), [bagian]: nilai } } })
  const ubahMasalah = (i: number, patch: Partial<BarisMasalah>) =>
    ubah({ masalah: n.masalah.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  function simpan() {
    mulai(async () => {
      const r = await simpanNarasiLaporanAction(periode, n)
      setPesan(r.error ? { ok: false, teks: r.error } : { ok: true, teks: r.success ?? 'Tersimpan.' })
      if (!r.error) setBerubah(false)
    })
  }

  const ro = !bisaUbah
  return (
    <div className="space-y-6">
      {ro && (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          Laporan tidak berstatus draf, jadi narasi hanya bisa dibaca. Kepala RQ bisa mengembalikannya ke draf.
        </p>
      )}

      <Bagian judul="Ringkasan Eksekutif" ket="Satu poin per baris.">
        <Kotak label="Sorotan Capaian" nilai={n.sorotan} baris={5} ro={ro} onChange={v => ubah({ sorotan: v })} />
        <Kotak label="Perhatian Utama" nilai={n.perhatian} baris={5} ro={ro} onChange={v => ubah({ perhatian: v })} />
      </Bagian>

      {sub.map(s => {
        const a = n.analisis[s.kunci] ?? KOSONG
        return (
          <Bagian key={s.kunci} judul={`${s.nomor}  ${s.judul}`} ket="Kotak Analisis & Rekomendasi di bawah tabel sub-bab ini.">
            <Kotak label="Analisis" nilai={a.analisis} baris={4} ro={ro} onChange={v => ubahAnalisis(s.kunci, 'analisis', v)} />
            <div className="grid gap-3 md:grid-cols-2">
              <Kotak label="Identifikasi masalah (satu per baris)" nilai={a.masalah} baris={3} ro={ro} onChange={v => ubahAnalisis(s.kunci, 'masalah', v)} />
              <Kotak label="Rekomendasi tindak lanjut (satu per baris)" nilai={a.rekomendasi} baris={3} ro={ro} onChange={v => ubahAnalisis(s.kunci, 'rekomendasi', v)} />
            </div>
          </Bagian>
        )
      })}

      <Bagian judul={`${nomorMasalah}  Identifikasi Masalah & Rekomendasi Tindak Lanjut`} ket="Baris usulan diisi otomatis dari angka; hapus yang tidak relevan.">
        <div className="space-y-3">
          {n.masalah.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_120px_auto]">
              <Input aria-label="Area fokus" placeholder="Area fokus" value={m.area} disabled={ro} onChange={e => ubahMasalah(i, { area: e.target.value })} />
              <textarea aria-label="Masalah utama" placeholder="Masalah utama" value={m.masalah} disabled={ro} rows={2}
                onChange={e => ubahMasalah(i, { masalah: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm" />
              <textarea aria-label="Rekomendasi" placeholder="Rekomendasi tindak lanjut" value={m.rekomendasi} disabled={ro} rows={2}
                onChange={e => ubahMasalah(i, { rekomendasi: e.target.value })} className="rounded-md border bg-background px-3 py-2 text-sm" />
              <select aria-label="Prioritas" value={m.prioritas} disabled={ro} onChange={e => ubahMasalah(i, { prioritas: e.target.value as BarisMasalah['prioritas'] })}
                className="h-9 rounded-md border bg-background px-2 text-sm">
                <option>Tinggi</option><option>Sedang</option><option>Rendah</option>
              </select>
              {!ro && (
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => ubah({ masalah: n.masalah.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!ro && (
            <Button type="button" variant="outline" size="sm" onClick={() => ubah({ masalah: [...n.masalah, { area: '', masalah: '', rekomendasi: '', prioritas: 'Sedang' }] })}>
              <Plus className="mr-1.5 h-4 w-4" />Tambah baris
            </Button>
          )}
        </div>
      </Bagian>

      <Bagian judul="Kesimpulan" ket="Satu paragraf per baris.">
        <Kotak label="Kesimpulan" nilai={n.kesimpulan} baris={6} ro={ro} onChange={v => ubah({ kesimpulan: v })} />
      </Bagian>

      {!ro && (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur md:bottom-4">
          <Button type="button" onClick={simpan} disabled={pending || !berubah}>
            <Save className="mr-1.5 h-4 w-4" />{pending ? 'Menyimpan…' : 'Simpan narasi'}
          </Button>
          {berubah && !pending && <span className="text-xs text-warning">Ada perubahan yang belum disimpan.</span>}
          {pesan && <span className={pesan.ok ? 'text-xs text-success' : 'text-xs text-destructive'}>{pesan.teks}</span>}
        </div>
      )}
    </div>
  )
}

function Bagian({ judul, ket, children }: { judul: string; ket?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
      <div>
        <h3 className="text-sm font-semibold">{judul}</h3>
        {ket && <p className="text-xs text-muted-foreground">{ket}</p>}
      </div>
      {children}
    </section>
  )
}

function Kotak({ label, nilai, baris, ro, onChange }: { label: string; nilai: string; baris: number; ro: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold">{label}</span>
      <textarea value={nilai} rows={baris} disabled={ro} onChange={e => onChange(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm leading-relaxed disabled:opacity-70" />
    </label>
  )
}
