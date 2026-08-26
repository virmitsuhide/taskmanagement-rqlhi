'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarX, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AlurStatus, Konfirmasi } from './EditTahfidzDialog'
import {
  formatTahsinLevels, fromDatetimeLocalWIB, toDatetimeLocalWIB,
} from '@/lib/rq/ujian'
import { deleteTahsinUjianAction, updateTahsinUjianAction } from '@/app/actions/ujian'
import type { UjianSiswa, UjianStatus, UjianTahsin } from '@/types'

interface Props {
  item: UjianTahsin
  pengujiOptions: string[]
  onClose: () => void
}

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function EditTahsinDialog({ item, pengujiOptions, onClose }: Props) {
  const router = useRouter()
  const [jadwal, setJadwal] = useState(toDatetimeLocalWIB(item.jadwal))
  const [penguji, setPenguji] = useState(item.penguji ?? '')
  const [siswa, setSiswa] = useState<UjianSiswa[]>(item.siswa)
  const [catatan, setCatatan] = useState(item.catatan ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<'hapus' | 'batal-jadwal' | null>(null)

  /**
   * Tampilan dikelompokkan per level, tapi indeks aslinya dibawa serta.
   *
   * Perubahan predikat harus menulis ke array `siswa` yang datar — kalau
   * ditulis lewat indeks di dalam kelompok, anak kedua pada level kedua akan
   * menimpa anak kedua pada level pertama.
   */
  const perLevel = useMemo(() => {
    const groups: { level: string; anggota: { s: UjianSiswa; index: number }[] }[] = []
    siswa.forEach((s, index) => {
      const level = s.level?.trim() || item.level
      let group = groups.find(g => g.level === level)
      if (!group) {
        group = { level, anggota: [] }
        groups.push(group)
      }
      group.anggota.push({ s, index })
    })
    return groups
  }, [siswa, item.level])

  function ubahPredikat(index: number, predikat: UjianSiswa['predikat']) {
    setSiswa(prev => prev.map((s, i) => (i === index ? { ...s, predikat } : s)))
  }

  function statusBaru(): UjianStatus {
    const semuaDinilai = siswa.length > 0 && siswa.every(s => s.predikat !== null)
    if (semuaDinilai) return 'selesai'
    if (jadwal && penguji) return 'dijadwalkan'
    return item.status === 'selesai' || item.status === 'dijadwalkan' ? item.status : 'diajukan'
  }

  async function simpan() {
    setError('')
    setLoading(true)
    try {
      const hasil = await updateTahsinUjianAction(item.id, {
        jadwal: fromDatetimeLocalWIB(jadwal),
        penguji: penguji || null,
        siswa,
        catatan: catatan || null,
        status: statusBaru(),
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
      const hasil = await updateTahsinUjianAction(item.id, {
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
      const hasil = await deleteTahsinUjianAction(item.id)
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

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.nama_kelompok}</DialogTitle>
          <DialogDescription>
            {formatTahsinLevels(item)} · Sesi {item.sesi} · Unit {item.unit}
          </DialogDescription>
        </DialogHeader>

        <AlurStatus status={item.status} />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jadwal">Jadwal ujian</Label>
            <Input id="jadwal" type="datetime-local" className="h-9"
              value={jadwal} onChange={e => setJadwal(e.target.value)} />
            <p className="text-xs text-muted-foreground">Waktu Indonesia Barat (WIB).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="penguji">Penguji</Label>
            <select id="penguji" value={penguji}
              onChange={e => setPenguji(e.target.value)} className={SELECT_CLASS}>
              <option value="">— Pilih penguji —</option>
              {penguji && !pengujiOptions.includes(penguji) && (
                <option value={penguji}>{penguji} (tidak lagi di daftar)</option>
              )}
              {pengujiOptions.map(nama => <option key={nama} value={nama}>{nama}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <Label>Hasil per siswa</Label>
            {perLevel.map(group => (
              <div key={group.level}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.level}
                </p>
                <ul className="space-y-2">
                  {group.anggota.map(({ s, index }) => (
                    <li key={index} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <span className="flex-1 truncate text-sm">{s.nama}</span>
                      <select
                        aria-label={`Hasil ${s.nama}`}
                        value={s.predikat ?? ''}
                        onChange={e => ubahPredikat(index, (e.target.value || null) as UjianSiswa['predikat'])}
                        className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">— Belum —</option>
                        <option value="lulus">Lulus</option>
                        <option value="mengulang">Mengulang</option>
                      </select>
                      {/* Mengeluarkan anak yang tidak hadir; hanya selagi ia
                          belum dinilai, supaya hasil yang sudah tercatat tidak
                          bisa dihapus lewat jalan ini. */}
                      {s.predikat === null && siswa.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon-sm"
                          aria-label={`Keluarkan ${s.nama} dari pengajuan`}
                          title="Keluarkan dari pengajuan (tidak hadir)"
                          onClick={() => setSiswa(prev => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catatan">Catatan penguji</Label>
            <Textarea id="catatan" value={catatan}
              onChange={e => setCatatan(e.target.value)} placeholder="Opsional" />
          </div>
        </div>

        <p className="rounded-lg bg-info-wash px-3 py-2 text-xs text-info">
          Status berubah sendiri: <strong>Dijadwalkan</strong> saat jadwal &amp; penguji terisi,
          <strong> Selesai</strong> saat semua siswa sudah dinilai.
        </p>

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
