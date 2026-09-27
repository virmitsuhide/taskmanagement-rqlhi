'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, MessageCircle, Repeat, UserCheck, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  tautkanSiswaEkstraAction, tawarkanBookingAction, terimaBookingAction, ubahStatusBookingAction,
  type TujuanHalaqoh,
} from '@/app/actions/ekstra'
import { PilihSiswa } from '@/components/ekstra/PilihSiswa'
import type { StatusBooking } from '@/lib/data/ekstra'

/** Halaqoh ekstra (pengampu + jadwal) yang bisa dituju. */
export interface InfoHalaqoh {
  id: string
  teacherId: string
  guru: string
  /** 'Selasa 15.30–16.30' */
  label: string
  tempat: string
  sisa: number
}

export interface BookingTampil {
  id: string
  status: StatusBooking
  nama_anak: string
  asal: 'lhi' | 'luar'
  student_id: string | null
  kelas: string
  posisi_bacaan: string
  nama_ortu: string
  wa: string
  catatan_ortu: string
  catatan_koor: string
  dibuat: string
  jenis: { nama: string; biaya: string; durasi: number }
  /** "Selasa, Kamis · Sore · setelah 15.30" */
  preferensi: string
  hariPilihan: number[]
  waktuPilihan: string[]
  /** Guru pilihan orang tua (urut sesuai pilihannya); kosong = siapa saja. */
  guruPilihan: { id: string; nama: string }[]
  /** Halaqoh tempat anak berada (aktif) — atau yang dipilih saat daftar di sistem lama. */
  halaqoh: InfoHalaqoh | null
  tawaran: InfoHalaqoh | null
}

interface Props {
  b: BookingTampil
  /** Halaqoh berjalan dengan jenis yang sama. */
  halaqohCocok: InfoHalaqoh[]
  /** Semua guru aktif — calon pengampu halaqoh baru. */
  guru: { id: string; nama: string }[]
  calon: { id: string; full_name: string; kelas: string | null; jenjang: string }[]
  namaSiswaTertaut?: string
}

export const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad']
export const MULAI: Record<string, string> = { pagi: '06:30', siang: '12:30', sore: '15:30', malam: '19:00' }

export function tambahMenit(jam: string, menit: number): string {
  const [h, m] = jam.split(':').map(Number)
  const t = Math.min(h * 60 + m + menit, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Tujuan yang dipilih + teks ringkas untuk pesan WhatsApp. */
export interface Pilihan { tujuan: TujuanHalaqoh; guru: string; jadwal: string; tempat: string }

export function teksWa(jenis: 'terima' | 'tawar' | 'tolak', b: BookingTampil, p: Pilihan | null, catatan = '') {
  // "ananda" hanya untuk siswa LHI; non siswa bisa jadi wali murid/dewasa yang mendaftar untuk dirinya.
  const peserta = b.asal === 'lhi' ? `ananda ${b.nama_anak}` : b.nama_anak
  const salam = `Assalamu'alaikum Ayah/Bunda ${b.nama_ortu}.`
  const penutup = "\n\nJazakumullahu khairan.\n— Koordinator Ekstra Rumah Qur'an LHI"
  const rinci = p ? `\n• ${b.jenis.nama}\n• Bersama ${p.guru}\n• ${p.jadwal}${p.tempat ? `\n• Tempat: ${p.tempat}` : ''}\n• Biaya: ${b.jenis.biaya}` : ''
  if (jenis === 'terima') {
    return `${salam}\n\nPermintaan ekstra untuk ${peserta} sudah kami jadwalkan:${rinci}${catatan ? `\n\n${catatan}` : ''}${penutup}`
  }
  if (jenis === 'tawar') {
    const nama = b.guruPilihan.map(g => g.nama)
    const daftar = nama.length > 1 ? `${nama.slice(0, -1).join(', ')} dan ${nama[nama.length - 1]}` : nama[0]
    const alasan = nama.length ? `${daftar} belum bisa pada waktu yang Ayah/Bunda pilih` : 'waktu yang Ayah/Bunda pilih belum tersedia'
    return `${salam}\n\nTerima kasih atas permintaan ekstra untuk ${peserta}. Mohon maaf, ${alasan}. Kami menawarkan:${rinci}\n\nMohon balas pesan ini bila bersedia.${catatan ? `\n\n${catatan}` : ''}${penutup}`
  }
  return `${salam}\n\nMohon maaf, permintaan ekstra untuk ${peserta} belum dapat kami penuhi saat ini.${catatan ? `\n\n${catatan}` : ''}${penutup}`
}

export type CaraPilih = 'ada' | 'baru'
export interface IsianBaru { teacher_id: string; hari: number; jam_mulai: string; jam_selesai: string; tempat: string; kuota: string }

/** Halaqoh guru pilihan lebih dulu (urut sesuai pilihan ortu), lalu yang kursinya paling banyak. */
export function urutHalaqoh(halaqohCocok: InfoHalaqoh[], pilihan: string[]): InfoHalaqoh[] {
  const peringkat = (id: string) => { const i = pilihan.indexOf(id); return i < 0 ? pilihan.length : i }
  return [...halaqohCocok].sort((x, y) => peringkat(x.teacherId) - peringkat(y.teacherId) || y.sisa - x.sisa)
}

export function kePilihan(cara: CaraPilih, slotId: string, n: IsianBaru, urut: InfoHalaqoh[], guru: { id: string; nama: string }[]): Pilihan | null {
  if (cara === 'ada') {
    const h = urut.find(x => x.id === slotId)
    return h ? { tujuan: { slotId: h.id }, guru: h.guru, jadwal: h.label, tempat: h.tempat } : null
  }
  const g = guru.find(x => x.id === n.teacher_id)
  return g && n.jam_selesai > n.jam_mulai ? {
    tujuan: { baru: { teacher_id: n.teacher_id, hari: n.hari, jam_mulai: n.jam_mulai, jam_selesai: n.jam_selesai, tempat: n.tempat, kuota: n.kuota ? Number(n.kuota) : null } },
    guru: g.nama, jadwal: `${HARI[n.hari]} ${n.jam_mulai.replace(':', '.')}–${n.jam_selesai.replace(':', '.')}`, tempat: n.tempat,
  } : null
}

/**
 * Keadaan awal pemilih: halaqoh berjalan yang masih ada kursi (guru pilihan
 * ortu lebih dulu), atau halaqoh baru yang terisi dari preferensi orang tua.
 * Saat MENAWARKAN guru lain, guru pilihan tidak diisikan — justru dia yang tidak bisa.
 */
export function awalPilihan(b: BookingTampil, halaqohCocok: InfoHalaqoh[], guru: { id: string; nama: string }[], tawar: boolean) {
  const idPilihan = b.guruPilihan.map(g => g.id)
  const urut = urutHalaqoh(halaqohCocok, idPilihan)
  // Menawarkan = guru pilihan tidak bisa, jadi halaqoh mereka tidak diusulkan lebih dulu.
  const adaKursi = urut.filter(h => h.sisa > 0 && !(tawar && idPilihan.includes(h.teacherId)))
  const cara: CaraPilih = adaKursi.length ? 'ada' : 'baru'
  const slotId = adaKursi[0]?.id ?? ''
  const mulai = MULAI[b.waktuPilihan[0] ?? 'sore'] ?? '15:30'
  const baru: IsianBaru = {
    teacher_id: !tawar && idPilihan.length ? idPilihan[0] : '', hari: b.hariPilihan[0] ?? 1,
    jam_mulai: mulai, jam_selesai: tambahMenit(mulai, b.jenis.durasi || 60), tempat: '', kuota: '',
  }
  return { urut, cara, slotId, baru, pilihan: kePilihan(cara, slotId, baru, urut, guru) }
}

export const wa = (no: string, teks: string) => `https://wa.me/${no}?text=${encodeURIComponent(teks)}`

export function KartuBooking({ b, halaqohCocok, guru, calon, namaSiswaTertaut }: Props) {
  const [pending, mulai] = useTransition()
  const [mode, setMode] = useState<null | 'tempatkan' | 'tawar' | 'tolak' | 'berhenti'>(null)
  const [siswa, setSiswa] = useState<string>(b.student_id ?? '')
  const [catatan, setCatatan] = useState('')
  const [pilihan, setPilihan] = useState<Pilihan | null>(null)
  const terbuka = b.status === 'baru' || b.status === 'ditawarkan'
  const studentId = b.asal === 'lhi' ? (siswa || null) : null

  function jalankan(fn: () => Promise<{ error?: string }>, pesan: string, pesanWa?: string) {
    // Jendela WA dibuka saat klik (bukan sesudah menunggu server) supaya tidak
    // diblokir peramban sebagai pop-up; isinya diarahkan setelah tersimpan.
    const jendela = pesanWa ? window.open('', '_blank') : null
    mulai(async () => {
      const r = await fn()
      if (r.error) { jendela?.close(); toast.error(r.error); return }
      toast.success(pesan)
      setMode(null)
      if (jendela && pesanWa) jendela.location.href = wa(b.wa, pesanWa)
    })
  }

  const buka = (m: 'tempatkan' | 'tawar') => { setPilihan(awalPilihan(b, halaqohCocok, guru, m === 'tawar').pilihan); setMode(m) }
  const halaqohTampil = b.status === 'ditawarkan' ? b.tawaran : b.halaqoh

  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-wash text-sm font-bold text-primary">
          {b.nama_anak.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {b.nama_anak}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              · {b.asal === 'lhi' ? 'Siswa LHI' : 'Non siswa LHI'}{b.kelas ? ` · ${b.kelas}` : ''}
            </span>
          </p>
          <p className="mt-0.5 text-[13px]"><b>{b.jenis.nama}</b> <span className="text-muted-foreground">· {b.jenis.biaya}</span></p>
          {terbuka && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Ingin: <span className="text-foreground">{b.preferensi}</span>
              {' · '}Guru pilihan: <span className="font-medium text-foreground">{b.guruPilihan.length ? b.guruPilihan.map(g => g.nama).join(', ') : 'siapa saja'}</span>
            </p>
          )}
          {halaqohTampil && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {b.status === 'ditawarkan' ? 'Ditawarkan: ' : b.status === 'aktif' ? 'Halaqoh: ' : 'Halaqoh: '}
              <b className="text-foreground">{halaqohTampil.guru}</b> · {halaqohTampil.label}{halaqohTampil.tempat ? ` · ${halaqohTampil.tempat}` : ''}
            </p>
          )}
          {b.posisi_bacaan && <p className="mt-0.5 text-[13px] text-muted-foreground">Posisi bacaan: {b.posisi_bacaan}</p>}
          {b.catatan_ortu && <p className="mt-1 text-[13px] italic">&ldquo;{b.catatan_ortu}&rdquo;</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {b.nama_ortu || 'Nama orang tua belum diisi'}
            {b.wa ? <> · <a href={`https://wa.me/${b.wa}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">WA {b.wa}</a></> : ' · WA belum diisi'}
            {' '}· masuk {b.dibuat}
          </p>
          {b.catatan_koor && <p className="mt-1 text-xs text-muted-foreground">Catatan koordinator: {b.catatan_koor}</p>}
        </div>
      </div>

      {/* Tautan ke data siswa — syarat setoran ekstra ikut capaian sekolah. */}
      {b.asal === 'lhi' && (terbuka || (b.status === 'aktif' && !b.student_id)) && (
        <div className="mt-3 rounded-xl bg-muted/50 p-3">
          <label className="text-xs font-semibold" htmlFor={`siswa-${b.id}`}>Tautkan ke data siswa LHI</label>
          <div className="mt-1.5 flex flex-wrap items-start gap-2">
            <PilihSiswa id={`siswa-${b.id}`} calon={calon} value={siswa} onChange={setSiswa} kosong="— Belum ditautkan —" />
            {b.status === 'aktif' && (
              <Button size="sm" variant="outline" disabled={pending || !siswa}
                onClick={() => jalankan(() => tautkanSiswaEkstraAction(b.id, siswa), 'Siswa ditautkan.')}>
                <UserCheck className="mr-1 h-3.5 w-3.5" />Tautkan
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Anak LHI yang tertaut: setoran ekstranya ikut menambah capaian di sekolah.
          </p>
        </div>
      )}
      {b.status === 'aktif' && b.student_id && namaSiswaTertaut && (
        <p className="mt-2 text-xs text-success">Tertaut ke data siswa: {namaSiswaTertaut} — setoran ekstra ikut capaian sekolah.</p>
      )}

      {(mode === 'tempatkan' || mode === 'tawar') && (
        <div className="mt-3 space-y-3 rounded-xl border p-3">
          <p className="text-xs font-semibold">
            {mode === 'tempatkan' ? 'Masukkan ke halaqoh ekstra' : 'Tawarkan guru / jadwal lain'}
          </p>
          <PilihHalaqoh b={b} halaqohCocok={halaqohCocok} guru={guru} tawar={mode === 'tawar'} onChange={setPilihan} />
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Catatan untuk orang tua (opsional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
            <Button size="sm" disabled={pending || !pilihan}
              onClick={() => pilihan && (mode === 'tempatkan'
                ? jalankan(() => terimaBookingAction(b.id, studentId, pilihan.tujuan), 'Anak masuk halaqoh ekstra.', teksWa('terima', b, pilihan, catatan))
                : jalankan(() => tawarkanBookingAction(b.id, pilihan.tujuan, catatan), 'Tawaran disimpan.', teksWa('tawar', b, pilihan, catatan)))}>
              <MessageCircle className="mr-1 h-3.5 w-3.5" />{mode === 'tempatkan' ? 'Masukkan & kirim WA' : 'Simpan & kirim WA'}
            </Button>
          </div>
        </div>
      )}

      {(mode === 'tolak' || mode === 'berhenti') && (
        <div className="mt-3 space-y-2 rounded-xl border p-3">
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
            placeholder={mode === 'tolak' ? 'Alasan (dikirim ke orang tua)' : 'Alasan berhenti (catatan internal)'}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
            <Button size="sm" variant="destructive" disabled={pending}
              onClick={() => jalankan(() => ubahStatusBookingAction(b.id, mode === 'tolak' ? 'ditolak' : 'berhenti', catatan),
                mode === 'tolak' ? 'Permintaan ditolak.' : 'Peserta diberhentikan.',
                mode === 'tolak' ? teksWa('tolak', b, null, catatan) : undefined)}>
              {mode === 'tolak' ? 'Tolak & kirim WA' : 'Berhentikan'}
            </Button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
          {terbuka && (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('tolak')}><X className="mr-1 h-3.5 w-3.5" />Tolak</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => buka('tawar')}><Repeat className="mr-1 h-3.5 w-3.5" />Tawarkan guru lain</Button>
              {b.status === 'ditawarkan' && b.tawaran && (
                <Button size="sm" variant="outline" disabled={pending || b.tawaran.sisa <= 0}
                  title={b.tawaran.sisa <= 0 ? 'Halaqoh yang ditawarkan sudah penuh' : undefined}
                  onClick={() => jalankan(() => terimaBookingAction(b.id, studentId), 'Orang tua setuju — anak masuk halaqoh.',
                    teksWa('terima', b, { tujuan: { slotId: b.tawaran!.id }, guru: b.tawaran!.guru, jadwal: b.tawaran!.label, tempat: b.tawaran!.tempat }))}>
                  <Check className="mr-1 h-3.5 w-3.5" />Ortu setuju
                </Button>
              )}
              <Button size="sm" disabled={pending} onClick={() => buka('tempatkan')}>
                <UsersRound className="mr-1 h-3.5 w-3.5" />Masukkan ke halaqoh
              </Button>
            </>
          )}
          {b.status === 'aktif' && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('berhenti')}>Berhentikan</Button>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Pemilih tujuan: halaqoh berjalan (jenis sama) atau halaqoh baru yang terisi
 * dari preferensi orang tua. Guru pilihan orang tua diurutkan paling atas.
 */
function PilihHalaqoh({ b, halaqohCocok, guru, tawar, onChange }: {
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

  return (
    <div className="space-y-3">
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {(['ada', 'baru'] as const).map(c => (
          <button key={c} type="button" role="radio" aria-checked={cara === c} disabled={c === 'ada' && urut.length === 0}
            onClick={() => { setCara(c); kirim(c, slotId, baru) }}
            className={cn('rounded-lg border px-3 py-2 text-left text-xs font-semibold disabled:opacity-40',
              cara === c ? 'border-primary bg-primary-wash text-primary' : 'bg-card')}>
            {c === 'ada' ? `Halaqoh yang ada (${urut.length})` : '+ Halaqoh baru'}
          </button>
        ))}
      </div>

      {cara === 'ada' ? (
        <select value={slotId} onChange={e => { setSlotId(e.target.value); kirim('ada', e.target.value, baru) }}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          {urut.map(h => (
            <option key={h.id} value={h.id} disabled={h.sisa <= 0}>
              {b.guruPilihan.some(g => g.id === h.teacherId) ? '★ ' : ''}{h.guru} · {h.label}{h.tempat ? ` · ${h.tempat}` : ''} · {h.sisa > 0 ? `sisa ${h.sisa}` : 'penuh'}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-semibold">Guru pengampu {b.guruPilihan.length > 0 && <span className="font-normal text-muted-foreground">(pilihan ortu: {b.guruPilihan.map(g => g.nama).join(', ')})</span>}</span>
            <select value={baru.teacher_id} onChange={e => ubahBaru({ teacher_id: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">— Pilih guru yang bisa —</option>
              {guru.map(g => <option key={g.id} value={g.id}>{b.guruPilihan.some(p => p.id === g.id) ? '★ ' : ''}{g.nama}</option>)}
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
