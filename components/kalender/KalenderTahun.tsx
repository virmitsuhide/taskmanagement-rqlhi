'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hapusAgendaAction, simpanAgendaAction, type IsianAgenda } from '@/app/actions/kaldik'
import {
  KALDIK_TIPE, KALDIK_UNIT, TIPE_LABEL, TIPE_WARNA, type KaldikTipe, type KaldikUnit,
} from '@/lib/data/kaldik'
import { cn } from '@/lib/utils'
import type { KaldiEvent } from '@/types'

interface Props {
  tahun: number
  events: KaldiEvent[]
  /** Unit yang boleh disunting pengguna ini; kosong = hanya melihat. */
  unitBoleh: KaldikUnit[]
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Penyaring unit.
 *
 * NASIONAL dan RQ selalu ikut tampil di semua pilihan: libur nasional dan
 * agenda lembaga mengenai seluruh sekolah. Wali murid SD yang menyaring "SD"
 * tetap perlu tahu kapan Idul Fitri dan kapan ada kegiatan yayasan.
 */
const SARINGAN = [
  { kode: 'SEMUA', label: 'Semua' },
  { kode: 'SD', label: 'SDIT' },
  { kode: 'SMP', label: 'SMPIT' },
  { kode: 'RQ', label: 'RQ LHI' },
] as const

type Saringan = (typeof SARINGAN)[number]['kode']

const KOSONG = (tanggal: string, unit: KaldikUnit): IsianAgenda => ({
  tanggal, judul: '', keterangan: '', unit, tipe: 'agenda',
})

/**
 * Kalender pendidikan setahun penuh — dua belas bulan dalam satu layar.
 *
 * Bentuk ini sengaja dipertahankan dari aplikasi kaldik lama: orang membuka
 * kalender sekolah untuk merencanakan, dan merencanakan semester menuntut
 * melihat lebih dari satu bulan sekaligus. Daftar per bulan yang harus
 * diklik dua belas kali menjawab pertanyaan yang berbeda.
 *
 * Terbuka untuk umum. Tombol sunting hanya muncul bagi koordinator unit yang
 * sedang masuk — isinya kalender sekolah, bukan rahasia; yang dijaga adalah
 * siapa yang boleh mengubahnya.
 */
export function KalenderTahun({ tahun, events, unitBoleh }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [saringan, setSaringan] = useState<Saringan>('SEMUA')
  const [form, setForm] = useState<{ id: string | null; isi: IsianAgenda } | null>(null)

  const perBulan = useMemo(() => {
    const cocok = (u: string) => saringan === 'SEMUA' || u === saringan || u === 'NASIONAL' || u === 'RQ'
    const kotak: KaldiEvent[][] = Array.from({ length: 12 }, () => [])
    for (const e of events) {
      const tgl = String(e.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) continue
      if (!cocok(String(e.unit ?? '').toUpperCase())) continue
      kotak[Number(tgl.slice(5, 7)) - 1].push(e)
    }
    for (const k of kotak) k.sort((a, b) => String(a.date).localeCompare(String(b.date)))
    return kotak
  }, [events, saringan])

  const jumlah = perBulan.reduce((n, k) => n + k.length, 0)
  const bolehUnit = (u: string | undefined) => unitBoleh.includes(String(u ?? '').toUpperCase() as KaldikUnit)

  function simpan() {
    if (!form) return
    mulai(async () => {
      const hasil = await simpanAgendaAction(form.id, form.isi)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      toast.success(form.id ? 'Agenda diperbarui.' : 'Agenda ditambahkan.')
      setForm(null)
      router.refresh()
    })
  }

  function hapus(e: KaldiEvent) {
    if (!confirm(`Hapus agenda "${e.title}" pada ${e.date}?`)) return
    mulai(async () => {
      const hasil = await hapusAgendaAction(String(e.id))
      if (hasil.error) toast.error(hasil.error)
      else {
        toast.success('Agenda dihapus.')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Penyaring & tombol tambah ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring unit">
          {SARINGAN.map(s => (
            <button
              key={s.kode}
              type="button"
              aria-pressed={saringan === s.kode}
              onClick={() => setSaringan(s.kode)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                saringan === s.kode ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
              )}
            >
              {s.label}
            </button>
          ))}
          <span className="self-center pl-1 text-xs text-muted-foreground">{jumlah} agenda</span>
        </div>

        {unitBoleh.length > 0 && (
          <Button type="button" size="sm" disabled={pending}
            onClick={() => setForm({ id: null, isi: KOSONG(`${tahun}-01-01`, unitBoleh[0]) })}>
            <Plus /> Tambah agenda
          </Button>
        )}
      </div>

      {/* ── Formulir ── */}
      {form && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary-wash/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{form.id ? 'Ubah agenda' : 'Agenda baru'}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)} disabled={pending}>
              <X />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="ag-tgl">Tanggal</label>
              <Input id="ag-tgl" type="date" value={form.isi.tanggal} disabled={pending} className="h-9"
                onChange={e => setForm({ ...form, isi: { ...form.isi, tanggal: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="ag-unit">Unit</label>
              <select
                id="ag-unit" value={form.isi.unit} disabled={pending}
                onChange={e => setForm({ ...form, isi: { ...form.isi, unit: e.target.value as KaldikUnit } })}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {KALDIK_UNIT.filter(u => unitBoleh.includes(u)).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium" htmlFor="ag-judul">Judul</label>
              <Input id="ag-judul" value={form.isi.judul} disabled={pending} className="h-9"
                placeholder="Class Meeting, Outing Class, Libur Semester…"
                onChange={e => setForm({ ...form, isi: { ...form.isi, judul: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="ag-tipe">Jenis</label>
              <select
                id="ag-tipe" value={form.isi.tipe} disabled={pending}
                onChange={e => setForm({ ...form, isi: { ...form.isi, tipe: e.target.value as KaldikTipe } })}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {KALDIK_TIPE.map(t => <option key={t} value={t}>{TIPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="ag-ket">Keterangan (opsional)</label>
              <Input id="ag-ket" value={form.isi.keterangan} disabled={pending} className="h-9"
                onChange={e => setForm({ ...form, isi: { ...form.isi, keterangan: e.target.value } })} />
            </div>
          </div>
          <Button type="button" onClick={simpan} disabled={pending || !form.isi.judul.trim()}>
            {pending ? 'Menyimpan…' : 'Simpan agenda'}
          </Button>
        </div>
      )}

      {/* ── Dua belas bulan ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {perBulan.map((agenda, i) => (
          <section key={i} className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
              {BULAN_ID[i]}
              <span className="text-[11px] font-normal text-muted-foreground">{agenda.length}</span>
            </h2>

            {agenda.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5">
                {agenda.map(e => (
                  <li key={String(e.id)} className="group flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: e.color ?? TIPE_WARNA[(e.type as KaldikTipe) ?? 'agenda'] ?? '#3B82F6' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug">
                        <b className="tabular-nums">{Number(String(e.date).slice(8))}</b> {e.title}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">{e.unit}</span>
                    </span>
                    {bolehUnit(e.unit) && (
                      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" disabled={pending} aria-label={`Ubah ${e.title}`}
                          className="rounded p-1 hover:bg-accent"
                          onClick={() => setForm({
                            id: String(e.id),
                            isi: {
                              tanggal: String(e.date),
                              judul: e.title,
                              keterangan: e.description ?? '',
                              unit: String(e.unit ?? 'SD').toUpperCase() as KaldikUnit,
                              tipe: (e.type as KaldikTipe) ?? 'agenda',
                            },
                          })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" disabled={pending} aria-label={`Hapus ${e.title}`}
                          className="rounded p-1 hover:bg-accent" onClick={() => hapus(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* ── Legenda ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border bg-card p-3 text-[11px]">
        {KALDIK_TIPE.map(t => (
          <span key={t} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: TIPE_WARNA[t] }} />
            {TIPE_LABEL[t]}
          </span>
        ))}
      </div>
    </div>
  )
}
