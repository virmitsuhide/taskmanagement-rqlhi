'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, MessageCircle, Plus, Repeat, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  tautkanSiswaEkstraAction, tawarkanBookingAction, terimaBookingAction, ubahStatusBookingAction,
} from '@/app/actions/ekstra'
import { PilihSiswa } from '@/components/ekstra/PilihSiswa'
import {
  awalPilihan, HARI, kePilihan, tambahMenit, teksWa, wa,
  type BookingTampil, type CaraPilih, type InfoHalaqoh, type IsianBaru, type Pilihan,
} from '@/components/ekstra/KartuBooking'
import { BAGIAN_HARI, HARI_PENDEK, LABEL_STATUS_BOOKING } from '@/lib/data/ekstra'

type Mode = 'tempatkan' | 'tawar' | 'tolak' | 'berhenti' | null

const inisial = (n: string) => n.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{children}</p>
}

/** Hari & bagian hari yang diminta orang tua, sebagai pita sepekan. */
export function PitaWaktu({ hari, waktu }: { hari: number[]; waktu: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map(h => (
          <span key={h} className={cn('flex h-9 items-center justify-center rounded-lg text-xs font-bold',
            hari.includes(h) ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground')}>
            {HARI_PENDEK[h]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {BAGIAN_HARI.map(b => {
          const on = waktu.includes(b.kode)
          return (
            <span key={b.kode} className={cn('rounded-lg border px-2 py-1.5', on ? 'border-primary bg-primary-wash' : 'bg-card')}>
              <span className={cn('block text-xs font-bold', on ? 'text-primary' : 'text-muted-foreground')}>{b.label}</span>
              <span className="block text-[10.5px] text-muted-foreground">{b.jam}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Detail satu permintaan ekstra — panel kanan kotak masuk Booking.
 * Logika aksi sama persis dengan KartuBooking; tampilannya: pemilih halaqoh
 * selalu terbuka, pratinjau pesan WhatsApp ikut berubah saat pilihan diganti.
 */
export function DetailBooking({ b, halaqohCocok, guru, calon, namaSiswaTertaut, menunggu }: {
  b: BookingTampil
  halaqohCocok: InfoHalaqoh[]
  guru: { id: string; nama: string }[]
  calon: { id: string; full_name: string; kelas: string | null; jenjang: string }[]
  namaSiswaTertaut?: string
  /** Hari sejak permintaan masuk. */
  menunggu: number
}) {
  const terbuka = b.status === 'baru' || b.status === 'ditawarkan'
  const [pending, mulai] = useTransition()
  const [mode, setMode] = useState<Mode>(terbuka ? 'tempatkan' : null)
  const [siswa, setSiswa] = useState<string>(b.student_id ?? '')
  const [catatan, setCatatan] = useState('')
  const [pilihan, setPilihan] = useState<Pilihan | null>(() => terbuka ? awalPilihan(b, halaqohCocok, guru, false).pilihan : null)
  const studentId = b.asal === 'lhi' ? (siswa || null) : null
  const halaqohTampil = b.status === 'ditawarkan' ? b.tawaran : b.halaqoh

  function jalankan(fn: () => Promise<{ error?: string }>, pesan: string, pesanWa?: string) {
    // Jendela WA dibuka saat klik supaya tidak diblokir sebagai pop-up.
    const jendela = pesanWa && b.wa ? window.open('', '_blank') : null
    mulai(async () => {
      const r = await fn()
      if (r.error) { jendela?.close(); toast.error(r.error); return }
      toast.success(pesan)
      if (jendela && pesanWa) jendela.location.href = wa(b.wa, pesanWa)
    })
  }
  const ganti = (m: 'tempatkan' | 'tawar') => { setPilihan(awalPilihan(b, halaqohCocok, guru, m === 'tawar').pilihan); setMode(m) }

  const pratinjau = mode === 'tempatkan' ? teksWa('terima', b, pilihan, catatan)
    : mode === 'tawar' ? teksWa('tawar', b, pilihan, catatan)
    : mode === 'tolak' ? teksWa('tolak', b, null, catatan) : ''

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border bg-card">
      <header className="flex items-start gap-4 border-b px-5 py-5 md:px-7">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-warm-wash text-base font-bold text-accent-warm">{inisial(b.nama_anak)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-[28px] leading-tight">{b.nama_anak}</h2>
            <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold',
              b.asal !== 'lhi' ? 'bg-muted text-muted-foreground' : b.student_id ? 'bg-primary-wash text-primary' : 'bg-accent-warm-wash text-accent-warm')}>
              {b.asal !== 'lhi' ? 'Non LHI' : b.student_id ? 'Siswa LHI' : 'LHI · belum tertaut'}
            </span>
            {terbuka ? (
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', menunggu > 3 ? 'bg-destructive-wash text-destructive' : 'bg-muted text-muted-foreground')}>
                {menunggu === 0 ? 'Masuk hari ini' : `Masuk ${menunggu} hari lalu`}
              </span>
            ) : (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{LABEL_STATUS_BOOKING[b.status]}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{b.jenis.nama} · {b.jenis.biaya} · {b.jenis.durasi} menit · masuk {b.dibuat}</p>
        </div>
      </header>

      <div className="grid gap-5 border-b px-5 py-5 sm:grid-cols-3 md:px-7">
        <div className="space-y-1">
          <Label>Kelas &amp; posisi bacaan</Label>
          <p className="text-sm">{b.kelas || '—'}{b.posisi_bacaan && <><br />{b.posisi_bacaan}</>}</p>
        </div>
        <div className="space-y-1">
          <Label>Orang tua</Label>
          <p className="text-sm">{b.nama_ortu || 'Belum diisi'}</p>
          {b.wa ? <a href={`https://wa.me/${b.wa}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">{b.wa}</a>
            : <p className="text-sm text-muted-foreground">WA belum diisi</p>}
        </div>
        <div className="space-y-1">
          <Label>Catatan orang tua</Label>
          <p className="text-sm">{b.catatan_ortu ? `“${b.catatan_ortu}”` : <span className="text-muted-foreground">—</span>}</p>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 md:px-7 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <Label>Waktu yang diminta</Label>
            <PitaWaktu hari={b.hariPilihan} waktu={b.waktuPilihan} />
            <p className="text-xs text-muted-foreground">{b.preferensi}</p>
          </div>
          <div className="space-y-2">
            <Label>Guru pilihan orang tua</Label>
            <div className="flex flex-wrap gap-1.5">
              {b.guruPilihan.length === 0 ? <span className="text-sm text-muted-foreground">Siapa saja</span> : b.guruPilihan.map(g => {
                const penuh = halaqohCocok.filter(h => h.teacherId === g.id).every(h => h.sisa <= 0)
                return (
                  <span key={g.id} className="rounded-md bg-accent-warm-wash px-2 py-1 text-xs font-semibold text-accent-warm">
                    ★ {g.nama}{halaqohCocok.some(h => h.teacherId === g.id) && penuh ? ' · penuh' : ''}
                  </span>
                )
              })}
            </div>
          </div>
          {halaqohTampil && (
            <div className="space-y-1">
              <Label>{b.status === 'ditawarkan' ? 'Sudah ditawarkan' : 'Halaqoh'}</Label>
              <p className="text-sm"><b>{halaqohTampil.guru}</b> · {halaqohTampil.label}{halaqohTampil.tempat ? ` · ${halaqohTampil.tempat}` : ''}</p>
            </div>
          )}
          {b.asal === 'lhi' && (terbuka || (b.status === 'aktif' && !b.student_id)) && (
            <div className="space-y-2">
              <Label>Tautkan ke data siswa LHI</Label>
              <div className="flex flex-wrap items-start gap-2">
                <PilihSiswa id={`siswa-${b.id}`} calon={calon} value={siswa} onChange={setSiswa} kosong="— Belum ditautkan —" />
                {b.status === 'aktif' && (
                  <Button size="sm" variant="outline" disabled={pending || !siswa}
                    onClick={() => jalankan(() => tautkanSiswaEkstraAction(b.id, siswa), 'Siswa ditautkan.')}>
                    <UserCheck className="mr-1 h-3.5 w-3.5" />Tautkan
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Setelah tertaut, setoran ekstranya ikut memajukan capaian sekolah tetapi tidak masuk laporan orang tua halaqoh.</p>
            </div>
          )}
          {b.status === 'aktif' && b.student_id && namaSiswaTertaut && (
            <p className="text-sm text-success">Tertaut ke data siswa: {namaSiswaTertaut}.</p>
          )}
          {b.catatan_koor && (
            <div className="space-y-1"><Label>Catatan koordinator</Label><p className="text-sm text-muted-foreground">{b.catatan_koor}</p></div>
          )}
        </div>

        {(mode === 'tempatkan' || mode === 'tawar') && (
          <div className="min-w-0 space-y-2">
            <Label>{mode === 'tempatkan' ? 'Masukkan ke halaqoh' : 'Tawarkan guru / jadwal lain'}</Label>
            <PilihanHalaqoh key={mode} b={b} halaqohCocok={halaqohCocok} guru={guru} tawar={mode === 'tawar'} onChange={setPilihan} />
          </div>
        )}
        {(mode === 'tolak' || mode === 'berhenti') && (
          <div className="min-w-0 space-y-2">
            <Label>{mode === 'tolak' ? 'Tolak permintaan' : 'Berhentikan peserta'}</Label>
            <p className="text-sm text-muted-foreground">{mode === 'tolak' ? 'Alasan di bawah ikut dikirim ke orang tua.' : 'Alasan disimpan sebagai catatan internal.'}</p>
          </div>
        )}
      </div>

      {mode && (
        <div className="space-y-3 px-5 pb-5 md:px-7">
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
            placeholder={mode === 'tolak' ? 'Alasan (dikirim ke orang tua)' : mode === 'berhenti' ? 'Alasan berhenti (catatan internal)' : 'Catatan untuk orang tua (opsional)'}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          {pratinjau && (
            <div className="rounded-2xl bg-[#E6DED0] p-3.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" />Pesan WhatsApp yang disiapkan</p>
              <p className="ml-auto max-w-[92%] whitespace-pre-line rounded-xl rounded-br-sm bg-[#DCF3D0] px-3 py-2.5 text-[13px] leading-relaxed text-[#17211F]">{pratinjau}</p>
            </div>
          )}
        </div>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-2 rounded-b-2xl border-t bg-muted/30 px-5 py-3.5 md:px-7">
        {terbuka && mode !== 'tolak' && <Button variant="outline" disabled={pending} onClick={() => { setCatatan(''); setMode('tolak') }}><X className="mr-1 h-4 w-4" />Tolak</Button>}
        {terbuka && mode === 'tolak' && <Button variant="outline" disabled={pending} onClick={() => ganti('tempatkan')}>Batal</Button>}
        {terbuka && mode === 'tempatkan' && <Button variant="outline" disabled={pending} onClick={() => ganti('tawar')}><Repeat className="mr-1 h-4 w-4" />Tawarkan guru lain</Button>}
        {terbuka && mode === 'tawar' && <Button variant="outline" disabled={pending} onClick={() => ganti('tempatkan')}>Kembali ke halaqoh yang ada</Button>}
        {b.status === 'ditawarkan' && b.tawaran && mode !== 'tolak' && (
          <Button variant="outline" disabled={pending || b.tawaran.sisa <= 0}
            title={b.tawaran.sisa <= 0 ? 'Halaqoh yang ditawarkan sudah penuh' : undefined}
            onClick={() => jalankan(() => terimaBookingAction(b.id, studentId), 'Orang tua setuju — anak masuk halaqoh.',
              teksWa('terima', b, { tujuan: { slotId: b.tawaran!.id }, guru: b.tawaran!.guru, jadwal: b.tawaran!.label, tempat: b.tawaran!.tempat }))}>
            <Check className="mr-1 h-4 w-4" />Ortu setuju tawaran
          </Button>
        )}
        {b.status === 'aktif' && mode !== 'berhenti' && <Button variant="outline" disabled={pending} onClick={() => setMode('berhenti')}>Berhentikan</Button>}
        {b.status === 'aktif' && mode === 'berhenti' && <Button variant="ghost" disabled={pending} onClick={() => setMode(null)}>Batal</Button>}
        <span className="flex-1" />
        {(mode === 'tempatkan' || mode === 'tawar') && (
          <>
            <span className="hidden text-xs text-muted-foreground sm:inline">WhatsApp terbuka setelah disimpan</span>
            <Button disabled={pending || !pilihan}
              onClick={() => pilihan && (mode === 'tempatkan'
                ? jalankan(() => terimaBookingAction(b.id, studentId, pilihan.tujuan), 'Anak masuk halaqoh ekstra.', teksWa('terima', b, pilihan, catatan))
                : jalankan(() => tawarkanBookingAction(b.id, pilihan.tujuan, catatan), 'Tawaran disimpan.', teksWa('tawar', b, pilihan, catatan)))}>
              <Check className="mr-1 h-4 w-4" />{mode === 'tempatkan' ? 'Masukkan & kirim WA' : 'Simpan tawaran & kirim WA'}
            </Button>
          </>
        )}
        {(mode === 'tolak' || mode === 'berhenti') && (
          <Button variant="destructive" disabled={pending}
            onClick={() => jalankan(() => ubahStatusBookingAction(b.id, mode === 'tolak' ? 'ditolak' : 'berhenti', catatan),
              mode === 'tolak' ? 'Permintaan ditolak.' : 'Peserta diberhentikan.',
              mode === 'tolak' ? teksWa('tolak', b, null, catatan) : undefined)}>
            {mode === 'tolak' ? 'Tolak & kirim WA' : 'Berhentikan'}
          </Button>
        )}
      </footer>
    </section>
  )
}

/** Halaqoh berjalan sebagai kartu pilihan + "Buat halaqoh baru" yang membuka isian jadwal. */
function PilihanHalaqoh({ b, halaqohCocok, guru, tawar, onChange }: {
  b: BookingTampil
  halaqohCocok: InfoHalaqoh[]
  guru: { id: string; nama: string }[]
  tawar: boolean
  onChange: (p: Pilihan | null) => void
}) {
  const awal = useMemo(() => awalPilihan(b, halaqohCocok, guru, tawar), [b, halaqohCocok, guru, tawar])
  const urut = awal.urut
  const [cara, setCara] = useState<CaraPilih>(awal.cara)
  const [slotId, setSlotId] = useState(awal.slotId)
  const [baru, setBaru] = useState<IsianBaru>(awal.baru)
  const kirim = (c: CaraPilih, sId: string, n: IsianBaru) => onChange(kePilihan(c, sId, n, urut, guru))
  const ubahBaru = (patch: Partial<IsianBaru>) => { const n = { ...baru, ...patch }; setBaru(n); kirim(cara, slotId, n) }
  const idPilihan = b.guruPilihan.map(g => g.id)

  return (
    <div role="radiogroup" className="space-y-2">
      {urut.length === 0 && <p className="text-sm text-muted-foreground">Belum ada halaqoh {b.jenis.nama} yang berjalan.</p>}
      {urut.map(h => {
        const on = cara === 'ada' && slotId === h.id
        const penuh = h.sisa <= 0
        return (
          <button key={h.id} type="button" role="radio" aria-checked={on} disabled={penuh}
            onClick={() => { setCara('ada'); setSlotId(h.id); kirim('ada', h.id, baru) }}
            className={cn('flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-50',
              on ? 'border-primary bg-primary-wash' : 'bg-card hover:border-primary/40')}>
            <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-muted-foreground/40')}>
              {on && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{idPilihan.includes(h.teacherId) && <span className="text-accent-warm">★ </span>}{h.guru}</span>
              <span className="block truncate text-xs text-muted-foreground">{h.label}{h.tempat ? ` · ${h.tempat}` : ''}</span>
            </span>
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold', penuh ? 'bg-muted text-muted-foreground' : 'bg-success-wash text-success')}>
              {penuh ? 'Penuh' : `Sisa ${h.sisa} kursi`}
            </span>
          </button>
        )
      })}
      <button type="button" role="radio" aria-checked={cara === 'baru'} onClick={() => { setCara('baru'); kirim('baru', slotId, baru) }}
        className={cn('flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left', cara === 'baru' ? 'border-primary bg-primary-wash' : 'hover:border-primary/40')}>
        <Plus className="h-4 w-4 shrink-0 text-primary" />
        <span>
          <span className="block text-sm font-bold">Buat halaqoh baru</span>
          <span className="block text-xs text-muted-foreground">Pilih guru ekstra, hari, jam, tempat — setelah guru menyanggupi</span>
        </span>
      </button>
      {cara === 'baru' && (
        <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-semibold">Guru pengampu</span>
            <select value={baru.teacher_id} onChange={e => ubahBaru({ teacher_id: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">— Pilih guru yang bisa —</option>
              {guru.map(g => <option key={g.id} value={g.id}>{idPilihan.includes(g.id) ? '★ ' : ''}{g.nama}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Hari</span>
            <select value={baru.hari} onChange={e => ubahBaru({ hari: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-sm">
              {HARI.slice(1).map((h, i) => <option key={h} value={i + 1}>{b.hariPilihan.includes(i + 1) ? '★ ' : ''}{h}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Mulai</span>
              <Input type="time" value={baru.jam_mulai} onChange={e => ubahBaru({ jam_mulai: e.target.value, jam_selesai: tambahMenit(e.target.value, b.jenis.durasi || 60) })} className="h-9" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Selesai</span>
              <Input type="time" value={baru.jam_selesai} onChange={e => ubahBaru({ jam_selesai: e.target.value })} className="h-9" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Tempat</span>
            <Input value={baru.tempat} onChange={e => ubahBaru({ tempat: e.target.value })} placeholder="mis. Perpustakaan SD / rumah siswa" className="h-9" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Kuota <span className="font-normal text-muted-foreground">(kosong = ikut jenis)</span></span>
            <Input type="number" min={1} max={50} value={baru.kuota} onChange={e => ubahBaru({ kuota: e.target.value })} className="h-9" />
          </label>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">★ = sesuai pilihan orang tua. Tanyakan dulu ke guru di luar sistem sebelum membuat halaqoh.</p>
        </div>
      )}
    </div>
  )
}
