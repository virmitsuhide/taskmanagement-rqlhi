'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, MessageCircle, Repeat, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  tautkanSiswaEkstraAction, tawarkanBookingAction, terimaBookingAction, ubahStatusBookingAction,
} from '@/app/actions/ekstra'
import type { StatusBooking } from '@/lib/data/ekstra'

export interface InfoSlot {
  id: string
  label: string
  guru: string
  jenis: string
  biaya: string
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
  slot: InfoSlot | null
  tawaran: InfoSlot | null
}

interface Props {
  b: BookingTampil
  /** Slot lain dengan jenis yang sama — pilihan tawaran. */
  alternatif: InfoSlot[]
  calon: { id: string; full_name: string; kelas: string | null; jenjang: string }[]
  namaSiswaTertaut?: string
}

function teksWa(jenis: 'terima' | 'tawar' | 'tolak', b: BookingTampil, slot: InfoSlot | null, catatan = '') {
  const salam = `Assalamu'alaikum Bapak/Ibu ${b.nama_ortu}.`
  const penutup = "\n\nJazakumullahu khairan.\n— Koordinator Ekstra Rumah Qur'an LHI"
  if (jenis === 'terima' && slot) {
    return `${salam}\n\nPermintaan ekstra untuk ananda ${b.nama_anak} kami terima:\n• ${slot.jenis}\n• Bersama ${slot.guru}\n• ${slot.label}\n• Biaya: ${slot.biaya}${catatan ? `\n\n${catatan}` : ''}${penutup}`
  }
  if (jenis === 'tawar' && slot) {
    return `${salam}\n\nMohon maaf, jadwal yang Bapak/Ibu pilih untuk ananda ${b.nama_anak} sudah penuh. Kami menawarkan jadwal lain:\n• ${slot.jenis}\n• Bersama ${slot.guru}\n• ${slot.label}\n\nMohon balas pesan ini bila bersedia.${catatan ? `\n\n${catatan}` : ''}${penutup}`
  }
  return `${salam}\n\nMohon maaf, permintaan ekstra untuk ananda ${b.nama_anak} belum dapat kami terima saat ini.${catatan ? `\n\n${catatan}` : ''}${penutup}`
}

const wa = (no: string, teks: string) => `https://wa.me/${no}?text=${encodeURIComponent(teks)}`

export function KartuBooking({ b, alternatif, calon, namaSiswaTertaut }: Props) {
  const [pending, mulai] = useTransition()
  const [mode, setMode] = useState<null | 'tawar' | 'tolak' | 'berhenti'>(null)
  const [siswa, setSiswa] = useState<string>(b.student_id ?? '')
  const [tawaran, setTawaran] = useState(alternatif[0]?.id ?? '')
  const [catatan, setCatatan] = useState('')
  const terbuka = b.status === 'baru' || b.status === 'ditawarkan'
  const slotAktif = b.status === 'ditawarkan' ? b.tawaran : b.slot

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

  const penuh = (slotAktif?.sisa ?? 0) <= 0

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
              · {b.asal === 'lhi' ? 'Siswa LHI' : 'Luar LHI'}{b.kelas ? ` · ${b.kelas}` : ''}
            </span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {slotAktif ? <>{slotAktif.jenis} · <b className="text-foreground">{slotAktif.guru}</b> · {slotAktif.label}</> : 'Slot sudah dihapus'}
            {b.status === 'ditawarkan' && b.slot && <> · <span className="line-through">{b.slot.label}</span></>}
          </p>
          {b.posisi_bacaan && <p className="mt-0.5 text-[13px] text-muted-foreground">Posisi bacaan: {b.posisi_bacaan}</p>}
          {b.catatan_ortu && <p className="mt-1 text-[13px] italic">&ldquo;{b.catatan_ortu}&rdquo;</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {b.nama_ortu} ·{' '}
            <a href={`https://wa.me/${b.wa}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">WA {b.wa}</a>
            {' '}· masuk {b.dibuat}
          </p>
          {b.catatan_koor && <p className="mt-1 text-xs text-muted-foreground">Catatan koordinator: {b.catatan_koor}</p>}
        </div>
        {terbuka && slotAktif && (
          <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold',
            penuh ? 'bg-destructive-wash text-destructive' : 'bg-success-wash text-success')}>
            {penuh ? 'Slot penuh' : `Sisa ${slotAktif.sisa}`}
          </span>
        )}
      </div>

      {/* Tautan ke data siswa — syarat setoran ekstra tercatat di aplikasi. */}
      {b.asal === 'lhi' && (terbuka || (b.status === 'aktif' && !b.student_id)) && (
        <div className="mt-3 rounded-xl bg-muted/50 p-3">
          <label className="text-xs font-semibold" htmlFor={`siswa-${b.id}`}>Tautkan ke data siswa LHI</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <select
              id={`siswa-${b.id}`}
              value={siswa}
              onChange={e => setSiswa(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">— Belum ditautkan —</option>
              {calon.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.kelas ? ` · ${c.kelas}` : ''} · {c.jenjang.toUpperCase()}</option>)}
            </select>
            {b.status === 'aktif' && (
              <Button size="sm" variant="outline" disabled={pending || !siswa}
                onClick={() => jalankan(() => tautkanSiswaEkstraAction(b.id, siswa), 'Siswa ditautkan.')}>
                <UserCheck className="mr-1 h-3.5 w-3.5" />Tautkan
              </Button>
            )}
          </div>
          {calon.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Tidak ada nama yang mirip. Setoran ekstra baru tercatat setelah anak ditautkan.</p>}
        </div>
      )}
      {b.status === 'aktif' && b.student_id && namaSiswaTertaut && (
        <p className="mt-2 text-xs text-success">Tertaut ke data siswa: {namaSiswaTertaut}</p>
      )}

      {mode === 'tawar' && (
        <div className="mt-3 space-y-2 rounded-xl border p-3">
          <label className="text-xs font-semibold" htmlFor={`tawar-${b.id}`}>Tawarkan jadwal lain</label>
          <select id={`tawar-${b.id}`} value={tawaran} onChange={e => setTawaran(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {alternatif.length === 0 && <option value="">Tidak ada slot lain untuk jenis ini</option>}
            {alternatif.map(s => <option key={s.id} value={s.id}>{s.guru} · {s.label} · sisa {s.sisa}</option>)}
          </select>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Catatan untuk orang tua (opsional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Batal</Button>
            <Button size="sm" disabled={pending || !tawaran}
              onClick={() => jalankan(() => tawarkanBookingAction(b.id, tawaran, catatan), 'Tawaran disimpan.',
                teksWa('tawar', b, alternatif.find(s => s.id === tawaran) ?? null, catatan))}>
              <MessageCircle className="mr-1 h-3.5 w-3.5" />Simpan &amp; kirim WA
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
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('tawar')}><Repeat className="mr-1 h-3.5 w-3.5" />Tawarkan jadwal lain</Button>
              <Button size="sm" disabled={pending || penuh}
                title={penuh ? 'Kuota slot penuh — tawarkan jadwal lain' : undefined}
                onClick={() => jalankan(() => terimaBookingAction(b.id, b.asal === 'lhi' ? (siswa || null) : null), 'Peserta diterima.',
                  teksWa('terima', b, slotAktif))}>
                <Check className="mr-1 h-3.5 w-3.5" />Terima &amp; kirim WA
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
