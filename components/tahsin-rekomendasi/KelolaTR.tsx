'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SELECT_NATIF } from '@/components/rapor/kontrol'
import {
  aturPesertaTRAction, hapusKelompokTRAction, resetSandiTRAction, tambahKelompokTRAction,
  ubahCapaianAwalTRAction, ubahKelompokTRAction,
} from '@/app/actions/tahsin-rekomendasi'
import type { KelompokTR, PesertaTR } from '@/lib/data/tahsin-rekomendasi'
import { PASSWORD_AWAL_TR } from '@/lib/rq/tahsin-rekomendasi'
import { cn } from '@/lib/utils'

interface Props {
  kelompok: KelompokTR[]
  peserta: PesertaTR[]
  kandidat: { id: string; full_name: string; kelas: string | null }[]
}

const INPUT = 'h-9 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary'

export function KelolaTR({ kelompok, peserta, kandidat }: Props) {
  return (
    <div className="space-y-5">
      <Kelompok kelompok={kelompok} peserta={peserta} />
      <Peserta kelompok={kelompok} peserta={peserta} kandidat={kandidat} />
    </div>
  )
}

// ─── Kelompok & akun ─────────────────────────────────────────────────────────

function Kelompok({ kelompok, peserta }: { kelompok: KelompokTR[]; peserta: PesertaTR[] }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [tambahBuka, setTambahBuka] = useState(kelompok.length === 0)
  const [baru, setBaru] = useState({ nama: '', gender: '', tempat: '' })

  function tambah() {
    mulai(async () => {
      const hasil = await tambahKelompokTRAction({ nama: baru.nama, gender: baru.gender || null, tempat: baru.tempat })
      if (hasil.error) toast.error(hasil.error)
      else {
        toast.success(`Akun ${hasil.username} dibuat — password ${PASSWORD_AWAL_TR}.`)
        setBaru({ nama: '', gender: '', tempat: '' })
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h2 className="font-heading text-2xl leading-tight">Kelompok &amp; akun pengampu</h2>
        <button type="button" onClick={() => setTambahBuka(b => !b)} aria-expanded={tambahBuka}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline">
          <Plus className="size-3.5" /> Tambah kelompok
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Satu kelompok = satu akun bersama (TR1, TR2, …) dengan password <b>{PASSWORD_AWAL_TR}</b>. Pengampunya bisa wali kelas SD.
        Bila pengampu berganti, cukup ganti namanya di sini — akun, peserta, dan riwayat setorannya tetap.
        Pengampu masuk lewat halaman login biasa dengan username akunnya.
      </p>

      {tambahBuka && (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
          <input value={baru.nama} onChange={e => setBaru(v => ({ ...v, nama: e.target.value }))} placeholder="Nama pengampu, mis. Ustadzah Rizky"
            aria-label="Nama pengampu" className={INPUT} />
          <select value={baru.gender} onChange={e => setBaru(v => ({ ...v, gender: e.target.value }))} aria-label="Jenis kelamin pengampu" className={cn(SELECT_NATIF, 'h-9')}>
            <option value="">L / P</option>
            <option value="L">Ustadz</option>
            <option value="P">Ustadzah</option>
          </select>
          <input value={baru.tempat} onChange={e => setBaru(v => ({ ...v, tempat: e.target.value }))} placeholder="Tempat, mis. Ruang Kelas 2C"
            aria-label="Tempat" className={INPUT} />
          <Button size="sm" className="h-9 rounded-xl" disabled={pending || !baru.nama.trim()} onClick={tambah}>Buat akun</Button>
        </div>
      )}

      {kelompok.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada kelompok.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {kelompok.map(k => <KartuKelompok key={k.teacher_id} k={k} jumlah={peserta.filter(p => p.teacher_id === k.teacher_id).length} />)}
        </ul>
      )}
    </section>
  )
}

function KartuKelompok({ k, jumlah }: { k: KelompokTR; jumlah: number }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [isi, setIsi] = useState({ nama: k.full_name, gender: k.gender ?? '', tempat: k.tempat })
  const berubah = isi.nama !== k.full_name || isi.gender !== (k.gender ?? '') || isi.tempat !== k.tempat

  const jalankan = (aksi: () => Promise<{ error?: string }>, pesan: string) => mulai(async () => {
    const hasil = await aksi()
    if (hasil.error) toast.error(hasil.error)
    else { toast.success(pesan); router.refresh() }
  })

  return (
    <li className="rounded-xl border p-3.5">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground">{k.username}</span>
        <span className="text-xs text-muted-foreground">{jumlah} siswa</span>
        <span className="ml-auto flex gap-0.5">
          <Button size="sm" variant="ghost" className="size-8 p-0" title={`Kembalikan password ke ${PASSWORD_AWAL_TR}`} aria-label={`Atur ulang password ${k.username}`}
            disabled={pending} onClick={() => jalankan(() => resetSandiTRAction(k.teacher_id), `Password ${k.username} kembali ke ${PASSWORD_AWAL_TR}.`)}>
            <KeyRound className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="size-8 p-0 text-destructive" title={jumlah ? 'Pindahkan / keluarkan pesertanya dulu' : 'Bubarkan kelompok'}
            aria-label={`Bubarkan ${k.username}`} disabled={pending || jumlah > 0}
            onClick={() => { if (confirm(`Bubarkan kelompok ${k.username}? Akunnya dinonaktifkan.`)) jalankan(() => hapusKelompokTRAction(k.teacher_id), `${k.username} dibubarkan.`) }}>
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-[1fr_6.5rem] gap-2">
        <input value={isi.nama} onChange={e => setIsi(v => ({ ...v, nama: e.target.value }))} aria-label={`Nama pengampu ${k.username}`} className={INPUT} />
        <select value={isi.gender} onChange={e => setIsi(v => ({ ...v, gender: e.target.value }))} aria-label={`Jenis kelamin pengampu ${k.username}`} className={cn(SELECT_NATIF, 'h-9')}>
          <option value="">—</option>
          <option value="L">Ustadz</option>
          <option value="P">Ustadzah</option>
        </select>
        <input value={isi.tempat} onChange={e => setIsi(v => ({ ...v, tempat: e.target.value }))} placeholder="Tempat" aria-label={`Tempat ${k.username}`}
          className={cn(INPUT, 'col-span-2')} />
      </div>
      {berubah && (
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="rounded-lg" disabled={pending} onClick={() => setIsi({ nama: k.full_name, gender: k.gender ?? '', tempat: k.tempat })}>Batal</Button>
          <Button size="sm" className="rounded-lg" disabled={pending || !isi.nama.trim()}
            onClick={() => jalankan(() => ubahKelompokTRAction(k.teacher_id, { nama: isi.nama, gender: isi.gender || null, tempat: isi.tempat }), `${k.username} diperbarui.`)}>
            Simpan
          </Button>
        </div>
      )}
    </li>
  )
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

const BATAS = 60

function Peserta({ kelompok, peserta, kandidat }: Props) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [saring, setSaring] = useState('')
  const [cari, setCari] = useState('')
  const [batas, setBatas] = useState(BATAS)
  const nama = new Map(kelompok.map(k => [k.teacher_id, `${k.username} · ${k.full_name}`]))

  const jalankan = (aksi: () => Promise<{ error?: string }>, pesan?: string) => mulai(async () => {
    const hasil = await aksi()
    if (hasil.error) toast.error(hasil.error)
    else { if (pesan) toast.success(pesan); router.refresh() }
  })

  const q = cari.trim().toLowerCase()
  const tampil = peserta
    .filter(p => !saring || p.teacher_id === saring)
    .filter(p => !q || p.full_name.toLowerCase().includes(q) || (p.kelas ?? '').toLowerCase().includes(q))

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="space-y-3 p-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-heading text-2xl leading-tight">Peserta</h2>
          {[{ id: '', label: 'Semua', n: peserta.length }, ...kelompok.map(k => ({ id: k.teacher_id, label: k.username, n: peserta.filter(p => p.teacher_id === k.teacher_id).length }))].map(c => (
            <button key={c.id || 'semua'} type="button" onClick={() => { setSaring(c.id); setBatas(BATAS) }}
              title={c.id ? nama.get(c.id) : undefined}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold transition-colors',
                saring === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
              {c.label}<span className={cn('tabular-nums', saring === c.id ? 'opacity-80' : 'text-muted-foreground')}>{c.n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Siswa SDIT LHI yang direkomendasikan ikut tahsin tambahan Jum&apos;at sore. Satu anak satu kelompok; pengampu hanya
          melihat dan mencatat anak di kelompoknya. Posisi kini ikut maju oleh setoran sekolah maupun TR.
        </p>

        {kelompok.length > 0 && <TambahPeserta kelompok={kelompok} kandidat={kandidat} awal={saring} />}

        <div className="relative sm:max-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={cari} onChange={e => { setCari(e.target.value); setBatas(BATAS) }} placeholder="Cari nama / kelas" aria-label="Cari peserta"
            className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      {tampil.length === 0 ? (
        <p className="border-t py-8 text-center text-sm text-muted-foreground">Belum ada peserta.</p>
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-5 py-2.5 font-bold">Siswa</th>
                <th className="px-2 py-2.5 font-bold">Kelas</th>
                <th className="px-2 py-2.5 font-bold">Capaian awal</th>
                <th className="px-2 py-2.5 font-bold">Posisi kini</th>
                <th className="px-2 py-2.5 font-bold">Kelompok</th>
                <th className="px-5 py-2.5"><span className="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tampil.slice(0, batas).map(p => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5">
                    <p className="font-bold">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.halaqoh_name ?? 'tanpa halaqoh'}</p>
                  </td>
                  <td className="px-2 py-2.5 font-bold">{p.kelas ?? '—'}</td>
                  <td className="px-2 py-2.5">
                    <input key={`${p.id}-${p.capaian_awal}`} defaultValue={p.capaian_awal} placeholder="mis. Jilid 2 hal 25" disabled={pending}
                      aria-label={`Capaian awal ${p.full_name}`} className={cn(INPUT, 'h-8 min-w-[9rem] text-[13px]')}
                      onBlur={e => { if (e.target.value.trim() !== p.capaian_awal) jalankan(() => ubahCapaianAwalTRAction(p.id, e.target.value)) }} />
                  </td>
                  <td className="px-2 py-2.5 text-[13px]">
                    {p.lulus_tahsin ? <span className="font-semibold text-primary">Lulus Tahsin</span> : p.posisi ?? '—'}
                    {p.drill && <span className="ml-1 rounded bg-accent-warm-wash px-1 text-[10.5px] font-bold text-accent-warm">drill</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    <select value={p.teacher_id} disabled={pending} aria-label={`Kelompok ${p.full_name}`}
                      onChange={e => jalankan(() => aturPesertaTRAction(p.id, e.target.value), `${p.full_name} dipindahkan.`)}
                      className={cn(SELECT_NATIF, 'h-8 min-w-[11rem] rounded-xl text-[13px] font-semibold')}>
                      {kelompok.map(k => <option key={k.teacher_id} value={k.teacher_id}>{k.username} · {k.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button type="button" disabled={pending}
                      onClick={() => { if (confirm(`Keluarkan ${p.full_name} dari Tahsin Rekomendasi? Riwayat setorannya tetap.`)) jalankan(() => aturPesertaTRAction(p.id, null), `${p.full_name} dikeluarkan.`) }}
                      className="text-[13px] font-bold text-destructive hover:underline disabled:opacity-50">
                      Keluarkan
                    </button>
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

/** Cari siswa SDIT yang belum ikut, pilih kelompoknya, isi capaian awal. */
function TambahPeserta({ kelompok, kandidat, awal }: { kelompok: KelompokTR[]; kandidat: Props['kandidat']; awal: string }) {
  const router = useRouter()
  const [pending, mulai] = useTransition()
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<Props['kandidat'][number] | null>(null)
  const [ke, setKe] = useState(awal || kelompok[0].teacher_id)
  const [capaian, setCapaian] = useState('')

  const q = cari.trim().toLowerCase()
  const cocok = q.length < 2 ? [] : kandidat.filter(s => s.full_name.toLowerCase().includes(q) || (s.kelas ?? '').toLowerCase() === q).slice(0, 8)

  function simpan() {
    if (!pilih) return
    mulai(async () => {
      const hasil = await aturPesertaTRAction(pilih.id, ke, capaian)
      if (hasil.error) toast.error(hasil.error)
      else {
        toast.success(`${pilih.full_name} masuk ${kelompok.find(k => k.teacher_id === ke)?.username ?? 'kelompok'}.`)
        setPilih(null); setCari(''); setCapaian('')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-dashed p-3">
      <p className="mb-2 text-xs font-bold text-muted-foreground">Tambah peserta</p>
      {pilih ? (
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem_11rem_auto]">
          <span className="flex min-w-0 items-center gap-2 rounded-xl bg-primary-wash px-3 py-1.5 text-sm">
            <span className="truncate font-bold">{pilih.full_name}</span>
            <span className="text-xs text-muted-foreground">{pilih.kelas}</span>
            <button type="button" aria-label="Batal pilih" onClick={() => setPilih(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
          </span>
          <select value={ke} onChange={e => setKe(e.target.value)} aria-label="Kelompok tujuan" className={cn(SELECT_NATIF, 'h-9')}>
            {kelompok.map(k => <option key={k.teacher_id} value={k.teacher_id}>{k.username} · {k.full_name}</option>)}
          </select>
          <input value={capaian} onChange={e => setCapaian(e.target.value)} placeholder="Capaian awal (opsional)" aria-label="Capaian awal" className={INPUT} />
          <Button size="sm" className="h-9 rounded-xl" disabled={pending} onClick={simpan}>Masukkan</Button>
        </div>
      ) : (
        <div className="relative sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Ketik nama siswa SDIT (min. 2 huruf) atau kelas, mis. 3b"
            aria-label="Cari siswa untuk ditambahkan" className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
          {cocok.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
              {cocok.map(s => (
                <li key={s.id}>
                  <button type="button" onClick={() => setPilih(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                    <span className="truncate">{s.full_name}</span><span className="shrink-0 text-xs font-bold text-muted-foreground">{s.kelas ?? '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && cocok.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Tidak ada siswa SDIT yang cocok, atau sudah menjadi peserta.</p>}
        </div>
      )}
    </div>
  )
}
