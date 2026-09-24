'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Repeat, Search, UserPlus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SELECT_NATIF } from '@/components/rapor/kontrol'
import {
  simpanJadwalRiyadhohAction, simpanPengampuRiyadhohAction, ubahPesertaRiyadhohAction,
} from '@/app/actions/riyadhoh'
import { jadwalBergantian, LABEL_KELOMPOK, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'
import type { PengampuRiyadhoh, PesertaRiyadhoh } from '@/lib/data/riyadhoh'
import { programLabel, UNIT_LABELS } from '@/lib/rq/programs'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
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

function labelSabtu(t: string): string {
  return new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function KelolaRiyadhoh(props: Props) {
  const peserta = props.siswa.filter(s => s.ikut)
  const jumlah = { L: peserta.filter(s => s.gender === 'L').length, P: peserta.filter(s => s.gender === 'P').length }
  const tanpaGender = peserta.filter(s => !s.gender)

  return (
    <div className="space-y-5">
      <Jadwal {...props} jumlah={jumlah} />
      <Pengampu pengampu={props.pengampu} guru={props.guru} />
      <Peserta siswa={props.siswa} jumlah={jumlah} tanpaGender={tanpaGender.length} />
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

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <Kepala ikon={<CalendarDays className="size-4" />} judul="Jadwal Sabtu">
        Tiap Sabtu diisi satu kelompok. Sabtu yang dibiarkan libur tidak muncul di Portal Guru.
      </Kepala>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="size-8 p-0" aria-label="Bulan sebelumnya"
              onClick={() => router.push(`/riyadhoh?bulan=${shiftPeriod(bulan, -1)}`)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium">{formatPeriod(bulan)}</span>
            <Button size="sm" variant="outline" className="size-8 p-0" aria-label="Bulan berikutnya"
              onClick={() => router.push(`/riyadhoh?bulan=${shiftPeriod(bulan, 1)}`)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsi(jadwalBergantian(sabtu, giliranSebelum))}
            title={giliranSebelum ? `Meneruskan giliran: Sabtu terakhir sebelumnya ${LABEL_KELOMPOK[giliranSebelum]}` : 'Mulai dari putra'}>
            <Repeat className="size-3.5" /> Isi bergantian
          </Button>
        </div>

        <ul className="divide-y rounded-lg border">
          {sabtu.map(t => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm">
                <span className="text-muted-foreground">Sabtu, </span>{labelSabtu(t)}
              </span>
              <div className="flex items-center gap-2">
                {isi[t] && <span className="hidden text-xs text-muted-foreground sm:inline">{jumlah[isi[t]!]} siswa</span>}
                <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label={`Kelompok ${labelSabtu(t)}`}>
                  {([...KELOMPOK, null] as (KelompokRiyadhoh | null)[]).map(g => (
                    <button
                      key={g ?? 'libur'}
                      type="button"
                      role="radio"
                      aria-checked={isi[t] === g}
                      onClick={() => setIsi(v => ({ ...v, [t]: g }))}
                      className={cn(
                        'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                        isi[t] === g
                          ? g === 'L' ? 'bg-sky-600 text-white' : g === 'P' ? 'bg-rose-600 text-white' : 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      {g ? LABEL_KELOMPOK[g] : 'Libur'}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button onClick={simpan} disabled={pending || !berubah}>{pending ? 'Menyimpan…' : 'Simpan jadwal'}</Button>
        </div>
      </div>
    </section>
  )
}

// ─── Pengampu ────────────────────────────────────────────────────────────────

function Pengampu({ pengampu, guru }: { pengampu: PengampuRiyadhoh[]; guru: Props['guru'] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [baru, setBaru] = useState('')
  const [kelompokBaru, setKelompokBaru] = useState<KelompokRiyadhoh[]>([])
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
    <section className="overflow-hidden rounded-2xl border bg-card">
      <Kepala ikon={<UserPlus className="size-4" />} judul="Pengampu">
        Guru SD maupun SMP. Pengampu hanya bisa mencatat pada Sabtu kelompok yang ia ampu.
      </Kepala>

      <div className="space-y-3 p-4">
        {pengampu.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pengampu.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {pengampu.map(p => (
              <li key={p.teacher_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{p.full_name}</span>
                  {unitGuru.get(p.teacher_id) && (
                    <span className="text-muted-foreground"> · {UNIT_LABELS[unitGuru.get(p.teacher_id) as keyof typeof UNIT_LABELS] ?? unitGuru.get(p.teacher_id)}</span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  {KELOMPOK.map(g => (
                    <Chip key={g} aktif={p.kelompok.includes(g)} kelompok={g} disabled={pending}
                      onClick={() => {
                        const k = ganti(p.kelompok, g)
                        simpan(p.teacher_id, k, k.length ? 'Pengampu diperbarui.' : `${p.full_name} tidak lagi mengampu.`)
                      }} />
                  ))}
                  <Button size="sm" variant="ghost" className="size-8 p-0" aria-label={`Hapus ${p.full_name}`} disabled={pending}
                    onClick={() => simpan(p.teacher_id, [], `${p.full_name} tidak lagi mengampu.`)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
          <select value={baru} onChange={e => setBaru(e.target.value)} className={cn(SELECT_NATIF, 'min-w-0 flex-1 sm:max-w-xs')} aria-label="Pilih guru">
            <option value="">Pilih guru…</option>
            {guru.filter(g => !sudah.has(g.id)).map(g => (
              <option key={g.id} value={g.id}>{g.full_name}{g.unit ? ` — ${UNIT_LABELS[g.unit as keyof typeof UNIT_LABELS] ?? g.unit}` : ''}</option>
            ))}
          </select>
          {KELOMPOK.map(g => (
            <Chip key={g} aktif={kelompokBaru.includes(g)} kelompok={g} onClick={() => setKelompokBaru(k => ganti(k, g))} />
          ))}
          <Button size="sm" disabled={pending || !baru || kelompokBaru.length === 0}
            onClick={() => simpan(baru, kelompokBaru, 'Pengampu ditambahkan.')}>
            Tambah
          </Button>
        </div>
      </div>
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
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50',
        aktif
          ? kelompok === 'L' ? 'border-sky-600 bg-sky-600 text-white' : 'border-rose-600 bg-rose-600 text-white'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {LABEL_KELOMPOK[kelompok]}
    </button>
  )
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

type Saring = 'L' | 'P' | 'tidak'

function Peserta({ siswa, jumlah, tanpaGender }: { siswa: PesertaRiyadhoh[]; jumlah: Record<KelompokRiyadhoh, number>; tanpaGender: number }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [saring, setSaring] = useState<Saring>('L')
  const [cari, setCari] = useState('')

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return siswa
      .filter(s => (saring === 'tidak' ? !s.ikut : s.ikut && s.gender === saring))
      .filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.kelas ?? '').toLowerCase().includes(q))
  }, [siswa, saring, cari])

  function ubah(s: PesertaRiyadhoh, ikut: boolean | null) {
    // Pengecualian yang sama dengan aturannya disimpan sebagai "ikut aturan".
    const nilai = ikut === s.bawaan ? null : ikut
    mulai(async () => {
      const hasil = await ubahPesertaRiyadhohAction(s.id, nilai)
      if (hasil.error) toast.error(hasil.error)
      else router.refresh()
    })
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <Kepala ikon={<Users className="size-4" />} judul="Peserta">
        Otomatis: seluruh kelas 9 SMP dan QuLS kelas 7–8. Anak yang perlu dikecualikan bisa dikeluarkan atau
        dimasukkan di sini; kenaikan kelas tahun depan terbaca sendiri.
      </Kepala>

      <div className="space-y-3 p-4">
        {tanpaGender > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {tanpaGender} peserta belum punya jenis kelamin di data siswa, jadi tidak masuk kelompok mana pun. Lengkapi di halaman Siswa.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            {(['L', 'P', 'tidak'] as Saring[]).map(k => (
              <button key={k} type="button" onClick={() => setSaring(k)}
                className={cn('rounded-md px-3 py-1 text-xs font-medium', saring === k ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
                {k === 'tidak' ? 'Tidak ikut' : `${LABEL_KELOMPOK[k]} (${jumlah[k]})`}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-60">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama / kelas" className="h-8 pl-8 text-sm" />
          </div>
        </div>

        {tampil.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada siswa.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tampil.map(s => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.kelas ?? '—'} · {programLabel('smp', s.program)}{s.halaqoh_name ? ` · ${s.halaqoh_name}` : ''}
                    {s.pengecualian !== undefined && (
                      <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] font-semibold">
                        {s.pengecualian ? 'ditambahkan koordinator' : 'dikeluarkan koordinator'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {s.pengecualian !== undefined && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => ubah(s, null)}>Ikut aturan</Button>
                  )}
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => ubah(s, !s.ikut)}>
                    {s.ikut ? 'Keluarkan' : 'Masukkan'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Kepala({ ikon, judul, children }: { ikon: React.ReactNode; judul: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">{ikon}</span>
      <div className="min-w-0 pt-1">
        <h2 className="font-heading text-lg font-medium leading-tight">{judul}</h2>
        {children && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>}
      </div>
    </header>
  )
}
