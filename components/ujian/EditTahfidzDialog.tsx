'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarX, Check, ChevronRight, Copy, Megaphone, MessageCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  PREDIKAT_OPTIONS, STATUS_FLOW,
  fromDatetimeLocalWIB, generateFlyerText, generateWAText,
  getStatusLabel, getTahfidzLabel, toDatetimeLocalWIB,
} from '@/lib/rq/ujian'
import { deleteTahfidzUjianAction, updateTahfidzUjianAction } from '@/app/actions/ujian'
import type { UjianPredikat, UjianStatus, UjianTahfidz } from '@/types'

interface Props {
  item: UjianTahfidz
  pengujiOptions: string[]
  onClose: () => void
}

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function EditTahfidzDialog({ item, pengujiOptions, onClose }: Props) {
  const router = useRouter()
  const [jadwal, setJadwal] = useState(toDatetimeLocalWIB(item.jadwal))
  const [penguji, setPenguji] = useState(item.penguji ?? '')
  const [namaAyah, setNamaAyah] = useState(item.nama_ayah)
  const [predikat, setPredikat] = useState<UjianPredikat | ''>(item.predikat ?? '')
  const [catatan, setCatatan] = useState(item.catatan ?? '')
  const [isQuls, setIsQuls] = useState(item.is_quls)
  const [gender, setGender] = useState<'putra' | 'putri'>('putri')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<'hapus' | 'batal-jadwal' | null>(null)

  /**
   * Status tidak diisi manual, melainkan disimpulkan dari kelengkapan isian.
   *
   * Alasannya: dua hal yang harus selalu selaras — "sudah punya jadwal" dan
   * "berstatus dijadwalkan" — kalau dipisah pasti ada saatnya berbeda, dan
   * antrian publik ikut salah tampil.
   */
  function statusBaru(): UjianStatus {
    if (predikat) return 'selesai'
    if (jadwal && penguji) return 'dijadwalkan'
    return item.status === 'selesai' || item.status === 'dijadwalkan' ? item.status : 'diajukan'
  }

  // Pratinjau memakai nilai form yang sedang diisi, bukan nilai tersimpan —
  // koordinator lazim menyalin teksnya sebelum menekan Simpan.
  const pratinjau: UjianTahfidz = {
    ...item,
    nama_ayah: namaAyah,
    penguji: penguji || item.penguji,
    predikat: (predikat || item.predikat) as UjianPredikat | null,
    is_quls: isQuls,
    jadwal: jadwal ? fromDatetimeLocalWIB(jadwal) : item.jadwal,
  }

  async function simpan() {
    setError('')
    setLoading(true)
    try {
      const hasil = await updateTahfidzUjianAction(item.id, {
        jadwal: fromDatetimeLocalWIB(jadwal),
        penguji: penguji || null,
        predikat: predikat || null,
        catatan: catatan || null,
        nama_ayah: namaAyah,
        status: statusBaru(),
        is_quls: isQuls,
      })
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      onClose()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function batalkanJadwal() {
    setError('')
    setLoading(true)
    try {
      const hasil = await updateTahfidzUjianAction(item.id, {
        jadwal: null, penguji: null, status: 'diajukan',
      })
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      onClose()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function hapus() {
    setError('')
    setLoading(true)
    try {
      const hasil = await deleteTahfidzUjianAction(item.id)
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      onClose()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const sudahDinilai = item.status === 'selesai' || Boolean(predikat)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.nama_siswa}</DialogTitle>
          <DialogDescription>
            {getTahfidzLabel(item.tipe, item.juz)} · Kelas {item.kelas} · Unit {item.unit}
          </DialogDescription>
        </DialogHeader>

        <AlurStatus status={item.status} />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jadwal">Jadwal ujian</Label>
            <Input
              id="jadwal" type="datetime-local" className="h-9"
              value={jadwal} onChange={e => setJadwal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Waktu Indonesia Barat (WIB).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="penguji">Penguji</Label>
            <select
              id="penguji" value={penguji}
              onChange={e => setPenguji(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">— Pilih penguji —</option>
              {/* Nama lama tetap bisa dipilih walau sudah dihapus dari daftar,
                  supaya menyimpan ulang tidak diam-diam mengosongkannya. */}
              {penguji && !pengujiOptions.includes(penguji) && (
                <option value={penguji}>{penguji} (tidak lagi di daftar)</option>
              )}
              {pengujiOptions.map(nama => <option key={nama} value={nama}>{nama}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nama_ayah">Nama ayah</Label>
            <Input id="nama_ayah" className="h-9" value={namaAyah}
              onChange={e => setNamaAyah(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="predikat">Predikat</Label>
            <select
              id="predikat" value={predikat}
              onChange={e => setPredikat(e.target.value as UjianPredikat | '')}
              className={SELECT_CLASS}
            >
              <option value="">— Belum dinilai —</option>
              {PREDIKAT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 select-none">
            <input type="checkbox" checked={isQuls}
              onChange={e => setIsQuls(e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-sm font-medium">Program QULS</span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="catatan">Catatan penguji</Label>
            <Textarea id="catatan" value={catatan}
              onChange={e => setCatatan(e.target.value)} placeholder="Opsional" />
          </div>
        </div>

        <p className="rounded-lg bg-info-wash px-3 py-2 text-xs text-info">
          Status berubah sendiri: <strong>Dijadwalkan</strong> saat jadwal &amp; penguji terisi,
          <strong> Selesai</strong> saat predikat terisi.
        </p>

        {sudahDinilai && (
          <>
            <BlokSalin
              icon={<MessageCircle className="h-4 w-4" />}
              judul="Pengumuman WhatsApp"
              teks={generateWAText(pratinjau, gender)}
              baris={8}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sapaan:</span>
                {(['putri', 'putra'] as const).map(g => (
                  <Button
                    key={g} type="button" size="xs"
                    variant={gender === g ? 'default' : 'outline'}
                    onClick={() => setGender(g)}
                  >
                    {g === 'putri' ? 'Putri' : 'Putra'}
                  </Button>
                ))}
              </div>
            </BlokSalin>

            <BlokSalin
              icon={<Megaphone className="h-4 w-4" />}
              judul="Data untuk pembuat flyer"
              teks={generateFlyerText(pratinjau)}
              baris={7}
            />
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button size="lg" className="flex-1" onClick={simpan} disabled={loading}>
            {loading ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>

        {item.status === 'dijadwalkan' && (
          konfirmasi === 'batal-jadwal' ? (
            <Konfirmasi
              pesan="Batalkan jadwal? Status kembali ke Diajukan dan penguji dikosongkan."
              labelYa="Ya, batalkan jadwal"
              loading={loading}
              onBatal={() => setKonfirmasi(null)}
              onYa={batalkanJadwal}
            />
          ) : (
            <Button variant="ghost" size="sm" className="w-full text-warning"
              onClick={() => setKonfirmasi('batal-jadwal')} disabled={loading}>
              <CalendarX className="mr-1.5 h-4 w-4" /> Batalkan jadwal ujian
            </Button>
          )
        )}

        {konfirmasi === 'hapus' ? (
          <Konfirmasi
            pesan="Hapus pengajuan ini? Tidak bisa dikembalikan."
            labelYa="Ya, hapus"
            loading={loading}
            onBatal={() => setKonfirmasi(null)}
            onYa={hapus}
          />
        ) : (
          <Button variant="ghost" size="sm" className="w-full text-destructive"
            onClick={() => setKonfirmasi('hapus')} disabled={loading}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Hapus pengajuan
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Bagian yang dipakai bersama dialog tahsin ────────────────────────────────

export function AlurStatus({ status }: { status: UjianStatus }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {STATUS_FLOW.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={status === s ? 'font-semibold text-primary' : undefined}>
            {getStatusLabel(s)}
          </span>
          {i < STATUS_FLOW.length - 1 && <ChevronRight className="h-3 w-3" />}
        </span>
      ))}
    </div>
  )
}

export function Konfirmasi({
  pesan, labelYa, loading, onBatal, onYa,
}: {
  pesan: string
  labelYa: string
  loading: boolean
  onBatal: () => void
  onYa: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-center text-sm">{pesan}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onBatal} disabled={loading}>
          Tidak
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" onClick={onYa} disabled={loading}>
          {loading ? 'Memproses…' : labelYa}
        </Button>
      </div>
    </div>
  )
}

function BlokSalin({
  icon, judul, teks, baris, children,
}: {
  icon: React.ReactNode
  judul: string
  teks: string
  baris: number
  children?: React.ReactNode
}) {
  const [tersalin, setTersalin] = useState(false)

  async function salin() {
    try {
      await navigator.clipboard.writeText(teks)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2500)
    } catch {
      // Clipboard ditolak (halaman non-HTTPS, izin peramban). Teksnya tetap
      // terlihat di kotak di atas dan bisa disalin manual, jadi tidak ada
      // yang perlu dilaporkan sebagai galat.
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">{icon}{judul}</p>
      {children}
      <textarea
        readOnly value={teks} rows={baris}
        className={cn(
          'w-full resize-none rounded-md border bg-muted/40 px-3 py-2',
          'font-mono text-xs text-muted-foreground outline-none',
        )}
      />
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={salin}>
        {tersalin
          ? <><Check className="mr-1.5 h-4 w-4 text-success" /> Tersalin</>
          : <><Copy className="mr-1.5 h-4 w-4" /> Salin teks</>}
      </Button>
    </div>
  )
}
