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
  bulan: number
  events: KaldiEvent[]
  /** Unit yang boleh disunting pengguna ini; kosong = hanya bisa melihat. */
  unitBoleh: KaldikUnit[]
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const KOSONG = (tanggal: string): IsianAgenda => ({
  tanggal, judul: '', keterangan: '', unit: 'SD', tipe: 'agenda',
})

/**
 * Daftar & penyuntingan agenda kaldik satu bulan.
 *
 * Agenda unit lain tetap ditampilkan — koor SD perlu melihat libur nasional
 * dan agenda lembaga untuk memahami bulannya — tapi tombol suntingnya hanya
 * muncul pada yang menjadi wewenangnya. Menyembunyikan seluruhnya akan
 * membuat kalender terbaca bolong.
 */
export function KelolaKaldik({ tahun, bulan, events, unitBoleh }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [form, setForm] = useState<{ id: string | null; isi: IsianAgenda } | null>(null)

  const bulanKode = `${tahun}-${String(bulan).padStart(2, '0')}`
  const daftar = useMemo(
    () => events
      .filter(e => String(e.date ?? '').startsWith(bulanKode))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [events, bulanKode],
  )

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
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Agenda {BULAN_ID[bulan - 1]} {tahun}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {daftar.length} agenda. Yang tampil di beranda dan menjadi usulan hari kosong di Kalender Qur&apos;an.
          </p>
        </div>
        {unitBoleh.length > 0 && (
          <Button type="button" size="sm" disabled={pending}
            onClick={() => setForm({ id: null, isi: { ...KOSONG(`${bulanKode}-01`), unit: unitBoleh[0] } })}>
            <Plus /> Tambah agenda
          </Button>
        )}
      </div>

      {form && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary-wash/30 p-3">
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

      {daftar.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada agenda bulan ini.</p>
      ) : (
        <ul className="divide-y">
          {daftar.map(e => (
            <li key={String(e.id)} className="flex items-start gap-3 py-2">
              <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: e.color ?? TIPE_WARNA[(e.type as KaldikTipe) ?? 'agenda'] ?? '#3B82F6' }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${e.date}T00:00:00+07:00`).toLocaleDateString('id-ID', {
                    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta',
                  })}
                  {' · '}{e.unit}
                  {' · '}{TIPE_LABEL[(e.type as KaldikTipe)] ?? e.type}
                  {e.description && ` · ${e.description}`}
                </p>
              </div>
              {bolehUnit(e.unit) && (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label="Ubah"
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
                    <Pencil />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label="Hapus"
                    onClick={() => hapus(e)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={cn('text-[11px] text-muted-foreground', unitBoleh.length > 0 && 'hidden')}>
        Anda dapat melihat agenda, tetapi penyuntingannya dipegang koordinator unit.
      </p>
    </section>
  )
}
