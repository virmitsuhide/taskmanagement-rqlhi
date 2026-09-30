'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Repeat, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SELECT_NATIF } from '@/components/rapor/kontrol'
import {
  aturPengampuSiswaAction, simpanJadwalRiyadhohAction, simpanPengampuRiyadhohAction, ubahPesertaRiyadhohAction,
} from '@/app/actions/riyadhoh'
import { jadwalBergantian, LABEL_KELOMPOK, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'
import type { PengampuRiyadhoh, PesertaRiyadhoh } from '@/lib/data/riyadhoh'
import { programLabel, UNIT_LABELS } from '@/lib/rq/programs'
import { formatPeriod, monthName, shiftPeriod } from '@/lib/finance/period'
import { cn } from '@/lib/utils'

interface Props {
  bulan: string
  sabtu: string[]
  jadwal: Record<string, KelompokRiyadhoh>
  /** Kelompok Sabtu terakhir bulan sebelumnya — untuk meneruskan giliran. */
  giliranSebelum: KelompokRiyadhoh | null
  pengampu: PengampuRiyadhoh[]
  siswa: PesertaRiyadhoh[]
  guru: { id: string; full_name: string; unit: string | null }[]
}

const KELOMPOK: KelompokRiyadhoh[] = ['L', 'P']

/** Warna kelompok — putra biru teduh, putri jingga hangat. */
const WARNA: Record<KelompokRiyadhoh, string> = {
  L: 'bg-info-wash text-info',
  P: 'bg-accent-warm-wash text-accent-warm',
}

function labelSabtu(t: string): string {
  return new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function tanggalPendek(t: string): string {
  return new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function inisial(nama: string): string {
  const kata = nama.replace(/^(ust(z|zh|adz|adzah)?\.?\s+)/i, '').split(/\s+/).filter(Boolean)
  return ((kata[0]?.[0] ?? '') + (kata[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function KelolaRiyadhoh(props: Props) {
  const peserta = props.siswa.filter(s => s.ikut)
  const jumlah = { L: peserta.filter(s => s.gender === 'L').length, P: peserta.filter(s => s.gender === 'P').length }
  const tanpaGender = peserta.filter(s => !s.gender)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7"><Jadwal {...props} jumlah={jumlah} /></div>
        <div className="lg:col-span-5"><Pengampu pengampu={props.pengampu} guru={props.guru} siswa={props.siswa} /></div>
      </div>
      <Peserta siswa={props.siswa} jumlah={jumlah} tanpaGender={tanpaGender.length} pengampu={props.pengampu} />
    </div>
  )
}

// ─── Jadwal ──────────────────────────────────────────────────────────────────

function Jadwal({ bulan, sabtu, jadwal, giliranSebelum, jumlah }: Props & { jumlah: Record<KelompokRiyadhoh, number> }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [isi, setIsi] = useState<Record<string, KelompokRiyadhoh | null>>(
    () => Object.fromEntries(sabtu.map(t => [t, jadwal[t] ?? null])),
  )
  const berubah = sabtu.some(t => (isi[t] ?? null) !== (jadwal[t] ?? null))

  function simpan() {
    mulai(async () => {
      const hasil = await simpanJadwalRiyadhohAction(isi)
      if (hasil.error) toast.error(hasil.error)
      else { toast.success(`Jadwal ${formatPeriod(bulan)} tersimpan.`); router.refresh() }
    })
  }

  /** Putra → Putri → Libur → Putra. */
  const berikut = (g: KelompokRiyadhoh | null): KelompokRiyadhoh | null => (g === 'L' ? 'P' : g === 'P' ? null : 'L')

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-2xl leading-tight">Jadwal {monthName(bulan)}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsi(jadwalBergantian(sabtu, giliranSebelum))}
            title={giliranSebelum ? `Meneruskan giliran: Sabtu terakhir sebelumnya ${LABEL_KELOMPOK[giliranSebelum]}` : 'Mulai dari putra'}
            className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
          >
            <Repeat className="size-3.5" /> Isi bergantian
          </button>
          <button type="button" aria-label="Bulan sebelumnya"
            onClick={() => router.push(`/riyadhoh?bulan=${shiftPeriod(bulan, -1)}`)}
            className="flex size-8 items-center justify-center rounded-full border bg-card hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Bulan berikutnya"
            onClick={() => router.push(`/riyadhoh?bulan=${shiftPeriod(bulan, 1)}`)}
            className="flex size-8 items-center justify-center rounded-full border bg-card hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Klik satu Sabtu untuk mengganti Putra · Putri · Libur. Sabtu yang libur tidak muncul di Portal Guru.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
        {sabtu.map(t => {
          const g = isi[t] ?? null
          const diubah = (g ?? null) !== (jadwal[t] ?? null)
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => setIsi(v => ({ ...v, [t]: berikut(v[t] ?? null) }))}
                aria-label={`Sabtu ${labelSabtu(t)}: ${g ? LABEL_KELOMPOK[g] : 'Libur'}. Klik untuk mengganti.`}
                className={cn(
                  'w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary',
                  diubah && 'border-primary ring-1 ring-primary/40',
                )}
              >
                <span className="block text-xs text-muted-foreground">Sabtu</span>
                <span className="mt-0.5 block font-heading text-xl leading-tight">{tanggalPendek(t)}</span>
                <span className={cn(
                  'mt-2.5 block rounded-lg py-1.5 text-center text-[13px] font-bold',
                  g ? WARNA[g] : 'bg-muted text-muted-foreground',
                )}>
                  {g ? LABEL_KELOMPOK[g] : 'Libur'}
                </span>
                <span className="mt-1 block text-center text-[11px] text-muted-foreground">
                  {g ? `${jumlah[g]} siswa` : '—'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-end gap-3">
        {berubah && <span className="text-xs text-muted-foreground">Ada perubahan belum disimpan</span>}
        <Button onClick={simpan} disabled={pending || !berubah} className="rounded-xl">
          {pending ? 'Menyimpan…' : 'Simpan jadwal'}
        </Button>
      </div>
    </section>
  )
}

// ─── Pengampu ────────────────────────────────────────────────────────────────

function Pengampu({ pengampu, guru, siswa }: { pengampu: PengampuRiyadhoh[]; guru: Props['guru']; siswa: PesertaRiyadhoh[] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [baru, setBaru] = useState('')
  const [kelompokBaru, setKelompokBaru] = useState<KelompokRiyadhoh[]>([])
  const [tambahBuka, setTambahBuka] = useState(pengampu.length === 0)
  const sudah = new Set(pengampu.map(p => p.teacher_id))
  const unitGuru = new Map(guru.map(g => [g.id, g.unit]))

  function simpan(teacherId: string, kelompok: KelompokRiyadhoh[], pesan: string) {
    mulai(async () => {
      const hasil = await simpanPengampuRiyadhohAction(teacherId, kelompok)
      if (hasil.error) toast.error(hasil.error)
      else { toast.success(pesan); setBaru(''); setKelompokBaru([]); router.refresh() }
    })
  }

  const ganti = (daftar: KelompokRiyadhoh[], g: KelompokRiyadhoh) => (daftar.includes(g) ? daftar.filter(x => x !== g) : [...daftar, g])

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <h2 className="font-heading text-2xl leading-tight">Pengampu</h2>
        <button
          type="button"
          onClick={() => setTambahBuka(b => !b)}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
          aria-expanded={tambahBuka}
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Guru SD maupun SMP. Pengampu hanya bisa mencatat pada Sabtu kelompok yang ia ampu.
      </p>

      {tambahBuka && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
          <select value={baru} onChange={e => setBaru(e.target.value)} className={cn(SELECT_NATIF, 'h-9 min-w-0 flex-1 basis-full')} aria-label="Pilih guru">
            <option value="">Pilih guru…</option>
            {guru.filter(g => !sudah.has(g.id)).map(g => (
              <option key={g.id} value={g.id}>{g.full_name}{g.unit ? ` — ${UNIT_LABELS[g.unit as keyof typeof UNIT_LABELS] ?? g.unit}` : ''}</option>
            ))}
          </select>
          {KELOMPOK.map(g => (
            <Chip key={g} aktif={kelompokBaru.includes(g)} kelompok={g} onClick={() => setKelompokBaru(k => ganti(k, g))} />
          ))}
          <Button size="sm" className="ml-auto rounded-lg" disabled={pending || !baru || kelompokBaru.length === 0}
            onClick={() => simpan(baru, kelompokBaru, 'Pengampu ditambahkan.')}>
            Tambah
          </Button>
        </div>
      )}

      {pengampu.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada pengampu.</p>
      ) : (
        <ul className="mt-1 divide-y">
          {pengampu.map(p => {
            const n = siswa.filter(s => s.ikut && s.pengampu_id === p.teacher_id).length
            const unit = unitGuru.get(p.teacher_id)
            return (
              <li key={p.teacher_id} className="flex items-center gap-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[11px] font-bold text-primary">
                  {inisial(p.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {n} peserta{unit ? ` · ${UNIT_LABELS[unit as keyof typeof UNIT_LABELS] ?? unit}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {KELOMPOK.map(g => (
                    <Chip key={g} aktif={p.kelompok.includes(g)} kelompok={g} disabled={pending}
                      onClick={() => {
                        const k = ganti(p.kelompok, g)
                        simpan(p.teacher_id, k, k.length ? 'Pengampu diperbarui.' : `${p.full_name} tidak lagi mengampu.`)
                      }} />
                  ))}
                  <Button size="sm" variant="ghost" className="size-7 p-0" aria-label={`Hapus ${p.full_name}`} disabled={pending}
                    onClick={() => simpan(p.teacher_id, [], `${p.full_name} tidak lagi mengampu.`)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Chip({ aktif, kelompok, onClick, disabled }: { aktif: boolean; kelompok: KelompokRiyadhoh; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-50',
        aktif ? WARNA[kelompok] : 'border text-muted-foreground hover:bg-muted',
      )}
    >
      {LABEL_KELOMPOK[kelompok]}
    </button>
  )
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

type Saring = 'semua' | 'L' | 'P' | 'belum' | 'tidak'

const BATAS = 50

function Peserta({ siswa, jumlah, tanpaGender, pengampu }: { siswa: PesertaRiyadhoh[]; jumlah: Record<KelompokRiyadhoh, number>; tanpaGender: number; pengampu: PengampuRiyadhoh[] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [saring, setSaring] = useState<Saring>('semua')
  const [cari, setCari] = useState('')
  const [batas, setBatas] = useState(BATAS)
  // Saringan pengampu: '' = semua, 'belum' = belum ditetapkan, selain itu id guru (0098).
  const [olehPengampu, setOlehPengampu] = useState('')
  const namaPengampu = new Map(pengampu.map(p => [p.teacher_id, p.full_name]))
  const kelompokSaring: KelompokRiyadhoh | null = saring === 'L' || saring === 'P' ? saring : null
  const pengampuKelompok = saring === 'tidak' || saring === 'belum'
    ? []
    : pengampu.filter(p => !kelompokSaring || p.kelompok.includes(kelompokSaring))

  const ikut = siswa.filter(s => s.ikut)
  const tanpaPengampu = ikut.filter(s => s.gender && !s.pengampu_id)
  const dikeluarkan = siswa.filter(s => !s.ikut)
  const belumDitetapkan = saring === 'tidak'
    ? 0
    : tanpaPengampu.filter(s => !kelompokSaring || s.gender === kelompokSaring).length

  const cocokSaring = (s: PesertaRiyadhoh) => {
    switch (saring) {
      case 'tidak': return !s.ikut
      case 'belum': return s.ikut && !!s.gender && !s.pengampu_id
      case 'semua': return s.ikut
      default: return s.ikut && s.gender === saring
    }
  }

  const q = cari.trim().toLowerCase()
  const tampil = siswa
    .filter(cocokSaring)
    .filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.kelas ?? '').toLowerCase().includes(q))
    .filter(s => !olehPengampu || (olehPengampu === 'belum' ? !s.pengampu_id : s.pengampu_id === olehPengampu))

  function aturPengampu(s: PesertaRiyadhoh, teacherId: string) {
    mulai(async () => {
      const hasil = await aturPengampuSiswaAction(s.id, teacherId || null)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  function ubah(s: PesertaRiyadhoh, ikut: boolean | null) {
    // Pengecualian yang sama dengan aturannya disimpan sebagai "ikut aturan".
    const nilai = ikut === s.bawaan ? null : ikut
    mulai(async () => {
      const hasil = await ubahPesertaRiyadhohAction(s.id, nilai)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  const chips: { key: Saring; label: string; n: number }[] = [
    { key: 'semua', label: 'Semua', n: ikut.length },
    { key: 'L', label: LABEL_KELOMPOK.L, n: jumlah.L },
    { key: 'P', label: LABEL_KELOMPOK.P, n: jumlah.P },
    { key: 'belum', label: 'Tanpa pengampu', n: tanpaPengampu.length },
    { key: 'tidak', label: 'Dikeluarkan / tidak ikut', n: dikeluarkan.length },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="space-y-3 p-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-heading text-2xl leading-tight">Peserta</h2>
          {chips.map(c => (
            <button key={c.key} type="button"
              onClick={() => { setSaring(c.key); setOlehPengampu(''); setBatas(BATAS) }}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors',
                saring === c.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}>
              {c.label}
              <span className={cn('tabular-nums', saring === c.key ? 'opacity-80' : 'text-muted-foreground')}>{c.n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Otomatis: seluruh kelas 9 SMP dan QuLS kelas 7–8. Anak yang perlu dikecualikan bisa dikeluarkan atau
          dimasukkan di sini; kenaikan kelas tahun depan terbaca sendiri. Tetapkan pengampu tiap anak — pengampu
          hanya melihat dan mencatat anak di kelompoknya.
        </p>

        {tanpaGender > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-wash px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {tanpaGender} peserta belum punya jenis kelamin di data siswa, jadi tidak masuk kelompok mana pun. Lengkapi di halaman Siswa.
          </p>
        )}
        {belumDitetapkan > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-wash px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {belumDitetapkan} peserta{kelompokSaring ? ` ${LABEL_KELOMPOK[kelompokSaring].toLowerCase()}` : ''} belum punya pengampu, jadi belum bisa dicatat
            kehadiran dan setorannya oleh siapa pun. Pilih pengampunya di daftar.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search" value={cari} onChange={e => { setCari(e.target.value); setBatas(BATAS) }}
              placeholder="Cari nama / kelas" aria-label="Cari siswa"
              className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          {pengampuKelompok.length > 0 && (
            <select value={olehPengampu} onChange={e => setOlehPengampu(e.target.value)} aria-label="Saring per pengampu"
              className={cn(SELECT_NATIF, 'h-9 w-auto text-sm')}>
              <option value="">Semua pengampu</option>
              {pengampuKelompok.map(p => (
                <option key={p.teacher_id} value={p.teacher_id}>
                  {p.full_name} ({siswa.filter(s => cocokSaring(s) && s.pengampu_id === p.teacher_id).length})
                </option>
              ))}
              <option value="belum">Belum ditetapkan ({siswa.filter(s => cocokSaring(s) && !s.pengampu_id).length})</option>
            </select>
          )}
        </div>
      </div>

      {tampil.length === 0 ? (
        <p className="border-t py-8 text-center text-sm text-muted-foreground">Tidak ada siswa.</p>
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-5 py-2.5 font-bold">Siswa</th>
                <th className="px-2 py-2.5 font-bold">Kelas</th>
                <th className="px-2 py-2.5 font-bold">Grup</th>
                <th className="px-2 py-2.5 font-bold">Pengampu</th>
                <th className="px-5 py-2.5 text-right font-bold"><span className="sr-only">Aturan &amp; tindakan</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tampil.slice(0, batas).map(s => (
                <tr key={s.id} className={cn(!s.ikut && 'text-muted-foreground')}>
                  <td className="px-5 py-2.5">
                    <p className="font-bold">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {programLabel('smp', s.program)}{s.halaqoh_name ? ` · ${s.halaqoh_name}` : ''}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 font-bold">{s.kelas ?? '—'}</td>
                  <td className="px-2 py-2.5">
                    {s.gender ? (
                      <span className={cn('inline-block min-w-16 rounded-md px-2 py-0.5 text-[11px] font-bold', WARNA[s.gender])}>
                        {LABEL_KELOMPOK[s.gender]}
                      </span>
                    ) : <span className="text-xs text-warning">belum diisi</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    {s.ikut && s.gender ? (
                      <select value={s.pengampu_id ?? ''} disabled={pending} onChange={e => aturPengampu(s, e.target.value)}
                        aria-label={`Pengampu ${s.full_name}`}
                        className={cn(SELECT_NATIF, 'h-9 min-w-[12rem] rounded-xl text-[13px] font-semibold', !s.pengampu_id && 'font-normal text-muted-foreground')}>
                        <option value="">— Pengampu belum ditetapkan —</option>
                        {pengampu.filter(p => p.kelompok.includes(s.gender!)).map(p => <option key={p.teacher_id} value={p.teacher_id}>{p.full_name}</option>)}
                        {s.pengampu_id && !pengampu.some(p => p.teacher_id === s.pengampu_id && p.kelompok.includes(s.gender!)) && (
                          <option value={s.pengampu_id}>{namaPengampu.get(s.pengampu_id) ?? 'Pengampu lama'}</option>
                        )}
                      </select>
                    ) : <span className="text-xs">—</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      <span className={cn('text-xs', s.pengecualian === false && 'text-destructive')}>
                        {s.pengecualian === undefined
                          ? s.ikut ? 'Ikut aturan' : 'Di luar aturan'
                          : s.pengecualian ? 'Dimasukkan manual' : 'Dikeluarkan'}
                      </span>
                      {s.pengecualian !== undefined && (
                        <button type="button" disabled={pending} onClick={() => ubah(s, null)}
                          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50">
                          Kembalikan ke aturan
                        </button>
                      )}
                      <button type="button" disabled={pending} onClick={() => ubah(s, !s.ikut)}
                        className={cn('text-[13px] font-bold hover:underline disabled:opacity-50', s.ikut ? 'text-destructive' : 'text-primary')}>
                        {s.ikut ? 'Keluarkan' : 'Masukkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tampil.length > batas && (
        <button type="button" onClick={() => setBatas(b => b + BATAS)}
          className="w-full border-t px-5 py-3 text-left text-[13px] font-bold text-primary hover:bg-muted/40">
          Tampilkan {Math.min(BATAS, tampil.length - batas)} lainnya · {tampil.length - batas} tersisa
        </button>
      )}
    </section>
  )
}

