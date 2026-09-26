'use client'

import { useActionState, useState } from 'react'
import { CheckCircle2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ajukanBookingEkstraAction } from '@/app/actions/ekstra'

export interface JenisPublik {
  id: string
  nama: string
  bidang: string
  deskripsi: string
  biaya: string
  waktu: string
}

export interface GuruPublik {
  id: string
  nama: string
}

// Sama dengan BAGIAN_HARI di lib/data/ekstra.ts — disalin karena berkas itu
// milik server (membaca Supabase) dan tidak boleh ikut ke peramban.
const BAGIAN = [
  { kode: 'pagi', label: 'Pagi', jam: '06.00–08.00' },
  { kode: 'siang', label: 'Siang', jam: '12.30–15.00' },
  { kode: 'sore', label: 'Sore', jam: '15.00–18.00' },
  { kode: 'malam', label: 'Malam', jam: '18.30–21.00' },
] as const
/** Sama dengan MAKS_GURU_PILIHAN di lib/data/ekstra.ts. */
const MAKS_GURU = 3
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad']

/**
 * Formulir booking ekstra (tanpa akun). Pesertanya siswa LHI, atau non siswa
 * LHI — wali murid yang mendaftar untuk dirinya sendiri, keluarga, atau umum.
 *
 * Orang tua menyampaikan KEINGINAN — jenis, waktu, dan (opsional) guru
 * pilihan. Jadwal dan guru ditetapkan Koordinator Ekstra setelah menanyakan
 * guru yang bisa pada waktu itu; bila guru pilihan tidak bisa, koordinator
 * menawarkan guru lain lewat WhatsApp.
 */
export function FormBookingEkstra({ jenis, guru, awal }: {
  jenis: JenisPublik[]
  guru: GuruPublik[]
  awal: { jenis?: string; guru?: string }
}) {
  const [jenisId, setJenisId] = useState(jenis.some(j => j.id === awal.jenis) ? awal.jenis! : jenis[0]?.id ?? '')
  const [guruIds, setGuruIds] = useState<string[]>(guru.some(g => g.id === awal.guru) ? [awal.guru!] : [])
  const [cariGuru, setCariGuru] = useState('')
  const [hari, setHari] = useState<number[]>([])
  const [waktu, setWaktu] = useState<string[]>([])
  const [asal, setAsal] = useState<'lhi' | 'luar'>('lhi')
  // Non siswa LHI bisa mendaftar untuk dirinya sendiri (wali murid, keluarga, umum).
  const [namaPeserta, setNamaPeserta] = useState('')
  const [diriSendiri, setDiriSendiri] = useState(false)
  const kontakSendiri = asal === 'luar' && diriSendiri
  const [dibuka] = useState(() => Date.now())
  const [state, aksi, pending] = useActionState(ajukanBookingEkstraAction, null)

  const tukar = <T,>(daftar: T[], v: T) => (daftar.includes(v) ? daftar.filter(x => x !== v) : [...daftar, v])
  const lengkap = !!jenisId && hari.length > 0 && waktu.length > 0

  if (state?.success) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-3 font-heading text-2xl">Permintaan terkirim</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Koordinator Ekstra akan mencarikan guru yang bisa pada waktu pilihan Anda, lalu mengonfirmasi jadwal dan biaya lewat WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <form action={aksi} className="space-y-8">
      {/* Penahan spam: kolom yang tak terlihat manusia, dan waktu formulir dibuka. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <input type="hidden" name="dibuka" value={dibuka} />
      <input type="hidden" name="jenis_id" value={jenisId} />
      <input type="hidden" name="asal" value={asal} />
      {hari.map(h => <input key={h} type="hidden" name="hari" value={h} />)}
      {waktu.map(w => <input key={w} type="hidden" name="waktu" value={w} />)}
      {guruIds.map(g => <input key={g} type="hidden" name="guru_pilihan_id" value={g} />)}

      {/* 1. Jenis */}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">1</span>Pilih jenis ekstra</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {jenis.map(x => (
            <button key={x.id} type="button" onClick={() => setJenisId(x.id)} aria-pressed={x.id === jenisId}
              className={cn('rounded-2xl border p-4 text-left transition-colors',
                x.id === jenisId ? 'border-primary bg-primary-wash' : 'bg-card hover:border-primary/40')}>
              <span className="block font-heading text-xl">{x.nama}</span>
              <span className="mt-1 block text-[13px] font-semibold text-accent-warm">{x.biaya}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{x.waktu}</span>
              {x.deskripsi && <span className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">{x.deskripsi}</span>}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 2. Waktu */}
      <fieldset className="min-w-0 space-y-4">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">2</span>Waktu yang diinginkan</legend>
        <div>
          <p className="mb-2 text-sm font-semibold">Hari <span className="font-normal text-muted-foreground">(boleh lebih dari satu)</span></p>
          <div role="group" aria-label="Hari" className="flex flex-wrap gap-2">
            {HARI.map((h, i) => (
              <button key={h} type="button" onClick={() => setHari(tukar(hari, i + 1))} aria-pressed={hari.includes(i + 1)}
                className={cn('h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors',
                  hari.includes(i + 1) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40')}>
                {h}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Bagian hari</p>
          <div role="group" aria-label="Bagian hari" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BAGIAN.map(b => (
              <button key={b.kode} type="button" onClick={() => setWaktu(tukar(waktu, b.kode))} aria-pressed={waktu.includes(b.kode)}
                className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors',
                  waktu.includes(b.kode) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40')}>
                <span className="block text-sm font-semibold">{b.label}</span>
                <span className={cn('block text-xs', waktu.includes(b.kode) ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{b.jam}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Keterangan jam <span className="font-normal text-muted-foreground">(opsional)</span></span>
          <Input name="catatan_waktu" maxLength={120} placeholder="mis. setelah pulang sekolah, sekitar 15.30" className="h-11" />
        </label>
      </fieldset>

      {/* 3. Guru pilihan — boleh lebih dari satu, maks. 3. */}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-bold">
          <span className="mr-2 text-accent-warm">3</span>Guru pilihan <span className="font-normal text-muted-foreground">(opsional, boleh lebih dari satu — maks. {MAKS_GURU})</span>
        </legend>
        <div className="mb-2 flex min-h-9 flex-wrap items-center gap-1.5">
          {guruIds.length === 0 ? (
            <span className="text-sm text-muted-foreground">Siapa saja — koordinator yang mencarikan.</span>
          ) : guruIds.map(id => (
            <button key={id} type="button" onClick={() => setGuruIds(guruIds.filter(x => x !== id))}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              aria-label={`Hapus ${guru.find(g => g.id === id)?.nama} dari pilihan`}>
              {guru.find(g => g.id === id)?.nama}<X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="rounded-xl border bg-card sm:max-w-md">
          <label className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={cariGuru} onChange={e => setCariGuru(e.target.value)} placeholder="Cari nama guru"
              aria-label="Cari nama guru" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <ul className="max-h-56 overflow-y-auto p-1">
            {guru.filter(g => g.nama.toLowerCase().includes(cariGuru.trim().toLowerCase())).map(g => {
              const dipilih = guruIds.includes(g.id)
              const penuh = !dipilih && guruIds.length >= MAKS_GURU
              return (
                <li key={g.id}>
                  <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm', dipilih ? 'bg-primary-wash font-semibold' : 'hover:bg-muted', penuh && 'cursor-not-allowed opacity-50')}>
                    <input type="checkbox" checked={dipilih} disabled={penuh} className="h-4 w-4 accent-primary"
                      onChange={() => setGuruIds(dipilih ? guruIds.filter(x => x !== g.id) : [...guruIds, g.id])} />
                    <span className="min-w-0">{g.nama}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pilihan guru adalah preferensi. Bila guru pilihan Anda tidak bisa pada waktu yang dipilih, koordinator akan menawarkan guru lain.
        </p>
      </fieldset>

      {/* 4. Peserta — siswa LHI atau non siswa LHI */}
      <fieldset className="min-w-0 space-y-4">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">4</span>Data peserta &amp; kontak</legend>
        <div role="tablist" aria-label="Jenis peserta" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:max-w-md">
          {([['lhi', 'Siswa LHI'], ['luar', 'Non siswa LHI']] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={asal === v} onClick={() => setAsal(v)}
              className={cn('h-10 rounded-lg text-sm font-semibold transition-colors', asal === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {asal === 'lhi'
            ? 'Siswa SDIT/SMPIT LHI yang masih aktif — capaian ekstranya ikut tercatat bersama capaian di sekolah.'
            : 'Wali murid yang ingin belajar sendiri, keluarga, atau umum di luar siswa LHI.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold">{asal === 'lhi' ? 'Nama siswa' : 'Nama peserta'}</span>
            <Input name="nama_anak" required minLength={3} autoComplete="off" placeholder="Nama lengkap" className="h-11"
              value={namaPeserta} onChange={e => setNamaPeserta(e.target.value)} />
          </label>
          {asal === 'luar' && (
            <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <input type="checkbox" checked={diriSendiri} onChange={e => setDiriSendiri(e.target.checked)} className="h-4 w-4 accent-primary" />
              Saya sendiri pesertanya
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{asal === 'lhi' ? 'Unit & kelas' : 'Keterangan peserta'}</span>
            <Input name="kelas" placeholder={asal === 'lhi' ? 'mis. SDIT 2A' : 'mis. dewasa, wali murid 3B, anak 7 tahun'} className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Posisi bacaan / hafalan <span className="font-normal text-muted-foreground">(bila tahu)</span></span>
            <Input name="posisi_bacaan" placeholder="mis. Jilid 3 hal. 20, hafal juz 30" className="h-11" />
          </label>
          {kontakSendiri ? (
            <input type="hidden" name="nama_ortu" value={namaPeserta} />
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{asal === 'lhi' ? 'Nama orang tua / wali' : 'Nama yang dihubungi'}</span>
              <Input name="nama_ortu" required minLength={3} className="h-11" />
            </label>
          )}
          <label className={cn('flex flex-col gap-1.5', kontakSendiri && 'sm:col-span-2')}>
            <span className="text-sm font-semibold">Nomor WhatsApp</span>
            <Input name="wa_ortu" required inputMode="tel" placeholder="08…" className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></span>
            <textarea name="catatan_ortu" rows={2} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Konfirmasi guru, jadwal, dan biaya dikirim ke nomor WhatsApp di atas. Data hanya dipakai Rumah Qur&apos;an untuk keperluan ekstra.
        </p>
      </fieldset>

      {state?.error && <p className="rounded-xl bg-destructive-wash px-4 py-3 text-sm font-medium text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || !lengkap} className="h-11 w-full rounded-xl bg-accent-warm px-6 font-bold text-white hover:bg-accent-warm/90 sm:w-auto">
        {pending ? 'Mengirim…' : !jenisId ? 'Pilih jenis ekstra' : hari.length === 0 ? 'Pilih hari lebih dulu' : waktu.length === 0 ? 'Pilih bagian hari' : 'Kirim permintaan'}
      </Button>
    </form>
  )
}
