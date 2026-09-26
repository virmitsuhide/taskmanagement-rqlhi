'use client'

import { useActionState, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
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

export interface SlotPublik {
  id: string
  jenis_id: string
  guru: string
  teacher_id: string
  label: string
  tempat: string
  sisa: number
}

/**
 * Formulir booking ekstra untuk orang tua (tanpa akun).
 * Pilih jenis → pilih jadwal → isi data anak & orang tua. Slot yang penuh
 * tetap bisa dipilih: koordinator akan menawarkan jadwal lain.
 */
export function FormBookingEkstra({ jenis, slot, awal, kunciGuru }: {
  jenis: JenisPublik[]
  slot: SlotPublik[]
  awal: { jenis?: string; slot?: string; guru?: string }
  /** Di halaman profil guru: jadwal hanya milik guru itu, tanpa pilihan guru lain. */
  kunciGuru?: boolean
}) {
  const slotAwal = slot.find(s => s.id === awal.slot)
  // Dari tombol "Booking ekstra" di profil guru: mulai dari jenis yang diampu guru itu.
  const jenisGuru = awal.guru ? slot.find(x => x.teacher_id === awal.guru)?.jenis_id : undefined
  const [jenisId, setJenisId] = useState(slotAwal?.jenis_id ?? awal.jenis ?? jenisGuru ?? jenis[0]?.id ?? '')
  const [slotId, setSlotId] = useState(slotAwal?.id ?? '')
  const [guru, setGuru] = useState(awal.guru ?? '')
  const [asal, setAsal] = useState<'lhi' | 'luar'>('lhi')
  const [dibuka] = useState(() => Date.now())
  const [state, aksi, pending] = useActionState(ajukanBookingEkstraAction, null)

  const pilihan = useMemo(
    () => slot.filter(s => s.jenis_id === jenisId && (!guru || s.teacher_id === guru)),
    [slot, jenisId, guru],
  )
  const j = jenis.find(x => x.id === jenisId)
  const s = slot.find(x => x.id === slotId)

  if (state?.success) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-3 font-heading text-2xl">Permintaan terkirim</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Koordinator Ekstra akan memeriksa kuota lalu mengonfirmasi jadwal dan biaya lewat WhatsApp ke nomor yang Anda isi.
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
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="asal" value={asal} />

      {/* 1. Jenis */}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">1</span>Pilih jenis ekstra</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {jenis.map(x => (
            <button key={x.id} type="button" onClick={() => { setJenisId(x.id); setSlotId('') }} aria-pressed={x.id === jenisId}
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

      {/* 2. Jadwal */}
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">2</span>Pilih jadwal pekanan</legend>
        {guru && !kunciGuru && (
          <p className="mb-2 text-xs text-muted-foreground">
            Menampilkan jadwal satu guru. <button type="button" onClick={() => setGuru('')} className="font-semibold text-primary underline">Tampilkan semua guru</button>
          </p>
        )}
        {pilihan.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Belum ada jadwal dibuka untuk {j?.nama ?? 'ekstra ini'}.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {pilihan.map(x => (
              <button key={x.id} type="button" onClick={() => setSlotId(x.id)} aria-pressed={x.id === slotId}
                className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  x.id === slotId ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40')}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{x.label}</span>
                  <span className={cn('block text-xs', x.id === slotId ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {x.guru}{x.tempat ? ` · ${x.tempat}` : ''}
                  </span>
                </span>
                <span className={cn('shrink-0 text-[11px] font-semibold', x.id === slotId ? '' : x.sisa > 0 ? 'text-success' : 'text-accent-warm')}>
                  {x.sisa > 0 ? `${x.sisa} kursi` : 'Penuh'}
                </span>
              </button>
            ))}
          </div>
        )}
        {s && s.sisa <= 0 && (
          <p className="mt-2 text-xs text-accent-warm">Jadwal ini penuh — Anda tetap bisa mendaftar; koordinator akan menawarkan jadwal lain.</p>
        )}
      </fieldset>

      {/* 3. Data */}
      <fieldset className="min-w-0 space-y-4">
        <legend className="mb-3 text-sm font-bold"><span className="mr-2 text-accent-warm">3</span>Data anak &amp; orang tua</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold">Nama anak</span>
            <Input name="nama_anak" required minLength={3} autoComplete="off" placeholder="Nama lengkap" className="h-11" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Sudah bersekolah di SIT LHI?</span>
            <div role="group" className="grid grid-cols-2 gap-2">
              {(['lhi', 'luar'] as const).map(v => (
                <button key={v} type="button" onClick={() => setAsal(v)} aria-pressed={asal === v}
                  className={cn('h-11 rounded-xl border text-sm font-semibold', asal === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
                  {v === 'lhi' ? 'Ya' : 'Belum'}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{asal === 'lhi' ? 'Unit & kelas' : 'Usia / kelas'}</span>
            <Input name="kelas" placeholder={asal === 'lhi' ? 'mis. SDIT 2A' : 'mis. 7 tahun'} className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold">Posisi bacaan / hafalan saat ini <span className="font-normal text-muted-foreground">(bila tahu)</span></span>
            <Input name="posisi_bacaan" placeholder="mis. Jilid 3 halaman 20, atau hafal juz 30" className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Nama orang tua</span>
            <Input name="nama_ortu" required minLength={3} className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Nomor WhatsApp</span>
            <Input name="wa_ortu" required inputMode="tel" placeholder="08…" className="h-11" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold">Catatan <span className="font-normal text-muted-foreground">(opsional)</span></span>
            <textarea name="catatan_ortu" rows={2} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Konfirmasi jadwal dan biaya dikirim ke nomor WhatsApp di atas. Data hanya dipakai Rumah Qur&apos;an untuk keperluan ekstra.
        </p>
      </fieldset>

      {state?.error && <p className="rounded-xl bg-destructive-wash px-4 py-3 text-sm font-medium text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || !slotId} className="h-11 w-full rounded-xl bg-accent-warm px-6 font-bold text-white hover:bg-accent-warm/90 sm:w-auto">
        {pending ? 'Mengirim…' : !slotId ? 'Pilih jadwal lebih dulu' : 'Kirim permintaan'}
      </Button>
    </form>
  )
}
