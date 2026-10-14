'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CircleAlert, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { aturAnggotaAction, simpanKelompokAction } from '@/app/actions/asrama'
import { ajukanNonaktifAction, tandaiCutiAction } from '@/app/actions/asrama-status'
import { LABEL_LEVEL, URUTAN_LEVEL, type LevelAsrama } from '@/lib/rq/asrama'
import type { KelompokAsrama } from '@/lib/data/asrama'
import type { AlasanNonaktif, JenisCuti } from '@/lib/rq/asrama-status'
import { cn } from '@/lib/utils'

export type Guru = { id: string; nama: string }
export type Calon = { id: string; nama: string; kelas: string | null; program?: string | null }
type Siswa = { id: string; nama: string; kelas: string | null }

export type KeadaanDialog =
  | { jenis: 'pindah'; siswa: Siswa; dariId: string; level: LevelAsrama | null }
  | { jenis: 'masukkan'; siswa: Siswa }
  | { jenis: 'tambah'; kelompokId: string | null }
  | { jenis: 'nonaktif'; siswa: Siswa; kelompokNama: string }
  | { jenis: 'cuti'; siswa: Siswa }
  | { jenis: 'kelompok'; kelompok?: KelompokAsrama }

function hariIni() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

const LABEL = 'mb-1.5 block text-sm font-bold'

function Pilihan({ aktif, onClick, judul, ket, kanan, nada = 'primary', disabled }: {
  aktif: boolean; onClick: () => void; judul: React.ReactNode; ket?: React.ReactNode; kanan?: React.ReactNode
  nada?: 'primary' | 'warm' | 'info'; disabled?: boolean
}) {
  const warna = nada === 'warm' ? 'border-accent-warm' : nada === 'info' ? 'border-info' : 'border-primary bg-primary-wash'
  const titik = nada === 'warm' ? 'border-accent-warm bg-accent-warm' : nada === 'info' ? 'border-info bg-info' : 'border-primary bg-primary'
  return (
    <button type="button" role="radio" aria-checked={aktif} disabled={disabled} onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors disabled:opacity-60',
        aktif ? warna : 'border-border hover:bg-muted/60')}>
      <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full border-2', aktif ? titik : 'border-muted-foreground/40')}>
        {aktif && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">{judul}</span>
        {ket && <span className="block text-xs text-muted-foreground">{ket}</span>}
      </span>
      {kanan}
    </button>
  )
}

function PilihLevel({ value, onChange }: { value: LevelAsrama | null; onChange: (l: LevelAsrama | null) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-muted p-1" role="radiogroup" aria-label="Level">
      {URUTAN_LEVEL.map(l => (
        <button key={l} type="button" role="radio" aria-checked={value === l} onClick={() => onChange(value === l ? null : l)}
          className={cn('rounded-md px-3 py-1 text-sm font-semibold', value === l ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {LABEL_LEVEL[l]}
        </button>
      ))}
    </div>
  )
}

/**
 * Dialog-dialog halaman Halaqoh Asrama: pindah kelompok, masukkan anak,
 * tambah anak (banyak sekaligus), ajukan nonaktif, tandai cuti/sakit, dan
 * buat/ubah kelompok.
 */
export function DialogAsrama({ keadaan, tutup, gender, kelompok, calon, guru }: {
  keadaan: KeadaanDialog
  tutup: () => void
  gender: 'L' | 'P'
  kelompok: KelompokAsrama[]
  calon: Calon[]
  guru: Guru[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function kirim(aksi: () => Promise<{ error?: string }>, sukses: string) {
    startTransition(async () => {
      const r = await aksi()
      if (r.error) { toast.error(r.error); return }
      toast.success(sukses)
      tutup()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={o => { if (!o && !pending) tutup() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {keadaan.jenis === 'pindah' || keadaan.jenis === 'masukkan'
          ? <IsiPindah keadaan={keadaan} kelompok={kelompok} pending={pending} tutup={tutup} kirim={kirim} />
          : keadaan.jenis === 'tambah'
            ? <IsiTambah kelompokId={keadaan.kelompokId} gender={gender} kelompok={kelompok} calon={calon} pending={pending} tutup={tutup} startTransition={startTransition} router={router} />
            : keadaan.jenis === 'nonaktif'
              ? <IsiNonaktif siswa={keadaan.siswa} kelompokNama={keadaan.kelompokNama} pending={pending} tutup={tutup} kirim={kirim} />
              : keadaan.jenis === 'cuti'
                ? <IsiCuti siswa={keadaan.siswa} pending={pending} tutup={tutup} kirim={kirim} />
                : <IsiKelompok kelompok={keadaan.kelompok} gender={gender} guru={guru} pending={pending} tutup={tutup} kirim={kirim} />}
      </DialogContent>
    </Dialog>
  )
}

type Kirim = (aksi: () => Promise<{ error?: string }>, sukses: string) => void

function Kaki({ tutup, pending, children }: { tutup: () => void; pending: boolean; children: React.ReactNode }) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={tutup} disabled={pending}>Batal</Button>
      {children}
    </DialogFooter>
  )
}

function IsiPindah({ keadaan, kelompok, pending, tutup, kirim }: {
  keadaan: Extract<KeadaanDialog, { jenis: 'pindah' | 'masukkan' }>
  kelompok: KelompokAsrama[]; pending: boolean; tutup: () => void; kirim: Kirim
}) {
  const dariId = keadaan.jenis === 'pindah' ? keadaan.dariId : null
  const [tujuan, setTujuan] = useState<string>(kelompok.find(k => k.id !== dariId)?.id ?? '')
  const [level, setLevel] = useState<LevelAsrama | null>(keadaan.jenis === 'pindah' ? keadaan.level : null)
  const nama = kelompok.find(k => k.id === tujuan)?.nama ?? ''
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{keadaan.jenis === 'pindah' ? 'Pindah kelompok' : 'Masukkan ke kelompok'}</DialogTitle>
        <DialogDescription>
          <b className="text-foreground">{keadaan.siswa.nama}{keadaan.siswa.kelas ? ` · ${keadaan.siswa.kelas}` : ''}</b>
          {keadaan.jenis === 'pindah' ? ' — pengampu asramanya ikut berganti. Riwayat setoran tetap tersimpan.' : ' — pilih kelompok dan level awalnya.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2" role="radiogroup">
        {kelompok.map(k => (
          <Pilihan key={k.id} aktif={tujuan === k.id} disabled={k.id === dariId} onClick={() => setTujuan(k.id)}
            judul={k.nama} ket={`${k.pengampu_nama ?? 'pengampu belum ditetapkan'} · ${k.anggota.length} anak`}
            kanan={k.id === dariId ? <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold">kelompok sekarang</span> : undefined} />
        ))}
      </div>
      <div>
        <span className={LABEL}>Level</span>
        <PilihLevel value={level} onChange={setLevel} />
      </div>
      <Kaki tutup={tutup} pending={pending}>
        <Button disabled={pending || !tujuan || tujuan === dariId}
          onClick={() => kirim(() => aturAnggotaAction(tujuan, keadaan.siswa.id, level), `${keadaan.siswa.nama.split(' ')[0]} masuk ${nama}.`)}>
          {keadaan.jenis === 'pindah' ? 'Pindahkan' : 'Masukkan'}
        </Button>
      </Kaki>
    </>
  )
}

function IsiTambah({ kelompokId, gender, kelompok, calon, pending, tutup, startTransition, router }: {
  kelompokId: string | null; gender: 'L' | 'P'; kelompok: KelompokAsrama[]; calon: Calon[]
  pending: boolean; tutup: () => void
  startTransition: React.TransitionStartFunction; router: ReturnType<typeof useRouter>
}) {
  const [tujuan, setTujuan] = useState(kelompokId ?? kelompok[0]?.id ?? '')
  const [tab, setTab] = useState<'calon' | 'semua'>(calon.length ? 'calon' : 'semua')
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  const [level, setLevel] = useState<LevelAsrama | null>(null)

  const anggotaLain = kelompok.filter(k => k.id !== tujuan).flatMap(k => k.anggota.map(a => ({ id: a.student_id, nama: a.nama, kelas: a.kelas, ket: `di ${k.nama}` })))
  const daftar = (tab === 'calon' ? [] : anggotaLain).concat(calon.map(c => ({ id: c.id, nama: c.nama, kelas: c.kelas, ket: 'belum berkelompok' })))
  const kata = cari.trim().toLowerCase()
  const tampil = daftar
    .filter(d => !kata || d.nama.toLowerCase().includes(kata) || (d.kelas ?? '').toLowerCase().includes(kata))
    .sort((a, b) => (a.ket === 'belum berkelompok' ? 0 : 1) - (b.ket === 'belum berkelompok' ? 0 : 1) || a.nama.localeCompare(b.nama, 'id'))
  const namaTujuan = kelompok.find(k => k.id === tujuan)?.nama ?? ''

  function simpan() {
    const ids = [...pilih]
    startTransition(async () => {
      let ok = 0
      for (const id of ids) {
        const r = await aturAnggotaAction(tujuan, id, level)
        if (r.error) { toast.error(r.error); break }
        ok++
      }
      if (ok) {
        toast.success(`${ok} anak ditambahkan ke ${namaTujuan}.`)
        tutup()
        router.refresh()
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Tambah anak{namaTujuan ? ` ke ${namaTujuan}` : ''}</DialogTitle>
        <DialogDescription>
          Hanya anak boarding {gender === 'L' ? 'putra' : 'putri'} SMPIT. Anak yang sudah punya kelompok akan dipindahkan.
        </DialogDescription>
      </DialogHeader>
      {!kelompokId && (
        <select value={tujuan} onChange={e => { setTujuan(e.target.value); setPilih(new Set()) }} aria-label="Kelompok tujuan"
          className="h-9 rounded-md border bg-background px-2 text-sm">
          {kelompok.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>
      )}
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau kelas" className="h-9 pl-9" />
      </label>
      <div className="flex gap-1.5">
        {([['calon', `Belum berkelompok ${calon.length}`], ['semua', 'Semua boarding']] as const).map(([t, l]) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', tab === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent')}>
            {l}
          </button>
        ))}
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {tampil.length === 0 && <li className="py-3 text-sm text-muted-foreground">{tab === 'calon' ? 'Semua anak boarding sudah berkelompok.' : 'Tidak ada yang cocok.'}</li>}
        {tampil.map(d => {
          const on = pilih.has(d.id)
          return (
            <li key={d.id} className="border-b last:border-0">
              <button type="button" role="checkbox" aria-checked={on}
                onClick={() => setPilih(s => { const n = new Set(s); if (on) n.delete(d.id); else n.add(d.id); return n })}
                className="flex w-full items-center gap-3 py-2 text-left">
                <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{d.nama}{d.kelas ? ` · ${d.kelas}` : ''}</span>
                  <span className="block text-xs text-muted-foreground">{d.ket}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold">Level awal</span>
        <PilihLevel value={level} onChange={setLevel} />
      </div>
      <Kaki tutup={tutup} pending={pending}>
        <Button disabled={pending || pilih.size === 0 || !tujuan} onClick={simpan}>
          Tambahkan{pilih.size ? ` ${pilih.size} anak` : ''}
        </Button>
      </Kaki>
    </>
  )
}

const ALASAN: { v: AlasanNonaktif; judul: string; ket: string }[] = [
  { v: 'fullday', judul: 'Pindah ke fullday', ket: 'Tetap siswa SMPIT, keluar dari asrama' },
  { v: 'pindah_sekolah', judul: 'Pindah sekolah', ket: 'Siswa dinonaktifkan di seluruh sistem' },
  { v: 'lainnya', judul: 'Lainnya', ket: 'Tulis alasannya di catatan' },
]

function IsiNonaktif({ siswa, kelompokNama, pending, tutup, kirim }: {
  siswa: Siswa; kelompokNama: string; pending: boolean; tutup: () => void; kirim: Kirim
}) {
  const [alasan, setAlasan] = useState<AlasanNonaktif>('fullday')
  const [tanggal, setTanggal] = useState(hariIni())
  const [catatan, setCatatan] = useState('')
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Ajukan nonaktif</DialogTitle>
        <DialogDescription>
          <b className="text-foreground">{siswa.nama}{siswa.kelas ? ` · ${siswa.kelas}` : ''}</b> · {kelompokNama}. Pengajuan dikirim ke{' '}
          <b className="text-foreground">Koor SMP</b> untuk diverifikasi ke kesiswaan SMP.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2" role="radiogroup" aria-label="Alasan">
        {ALASAN.map(a => <Pilihan key={a.v} nada="warm" aktif={alasan === a.v} onClick={() => setAlasan(a.v)} judul={a.judul} ket={a.ket} />)}
      </div>
      <label>
        <span className={LABEL}>Tanggal efektif</span>
        <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-10" />
      </label>
      <label>
        <span className={LABEL}>Catatan untuk Koor SMP{alasan === 'lainnya' ? ' (wajib)' : ''}</span>
        <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={3}
          placeholder={alasan === 'fullday' ? 'Mis. orang tua mengajukan pindah ke fullday mulai semester depan.' : alasan === 'pindah_sekolah' ? 'Mis. pindah ke Bandung mengikuti orang tua.' : 'Tuliskan alasannya.'} />
      </label>
      <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-accent-warm" />
        Sampai disetujui, anak tetap di kelompoknya dan tetap bisa disetorkan.
      </p>
      <Kaki tutup={tutup} pending={pending}>
        <Button className="bg-accent-warm text-white hover:bg-accent-warm/90" disabled={pending || !tanggal || (alasan === 'lainnya' && !catatan.trim())}
          onClick={() => kirim(() => ajukanNonaktifAction({ studentId: siswa.id, alasan, tanggalEfektif: tanggal, catatan }), 'Pengajuan dikirim ke Koor SMP.')}>
          Kirim pengajuan
        </Button>
      </Kaki>
    </>
  )
}

function IsiCuti({ siswa, pending, tutup, kirim }: { siswa: Siswa; pending: boolean; tutup: () => void; kirim: Kirim }) {
  const [jenis, setJenis] = useState<JenisCuti>('sakit')
  const [sejak, setSejak] = useState(hariIni())
  const [kembali, setKembali] = useState('')
  const [catatan, setCatatan] = useState('')
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Tandai cuti / sakit</DialogTitle>
        <DialogDescription>
          <b className="text-foreground">{siswa.nama}{siswa.kelas ? ` · ${siswa.kelas}` : ''}</b> tetap di kelompoknya, hanya diberi tanda — tidak perlu persetujuan.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2" role="radiogroup" aria-label="Jenis">
        <Pilihan nada="info" aktif={jenis === 'sakit'} onClick={() => setJenis('sakit')} judul="Sakit" />
        <Pilihan nada="info" aktif={jenis === 'cuti'} onClick={() => setJenis('cuti')} judul="Cuti / izin keluarga" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={LABEL}>Sejak tanggal</span>
          <Input type="date" value={sejak} onChange={e => setSejak(e.target.value)} className="h-10" />
        </label>
        <label>
          <span className={LABEL}>Perkiraan kembali <span className="font-normal text-muted-foreground">(opsional)</span></span>
          <Input type="date" value={kembali} min={sejak} onChange={e => setKembali(e.target.value)} className="h-10" />
        </label>
      </div>
      <label>
        <span className={LABEL}>Keterangan <span className="font-normal text-muted-foreground">(opsional)</span></span>
        <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Mis. rawat di rumah" className="h-10" />
      </label>
      <Kaki tutup={tutup} pending={pending}>
        <Button disabled={pending || !sejak}
          onClick={() => kirim(() => tandaiCutiAction({ studentId: siswa.id, jenis, sejak, kembali: kembali || null, catatan }), `${siswa.nama.split(' ')[0]} ditandai ${jenis === 'sakit' ? 'sakit' : 'cuti'}.`)}>
          Simpan
        </Button>
      </Kaki>
    </>
  )
}

function IsiKelompok({ kelompok, gender, guru, pending, tutup, kirim }: {
  kelompok?: KelompokAsrama; gender: 'L' | 'P'; guru: Guru[]; pending: boolean; tutup: () => void; kirim: Kirim
}) {
  const [nama, setNama] = useState(kelompok?.nama ?? '')
  const [pengampu, setPengampu] = useState(kelompok?.pengampu_id ?? '')
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{kelompok ? 'Ubah kelompok' : 'Kelompok baru'}</DialogTitle>
        <DialogDescription>Asrama {gender === 'L' ? 'putra' : 'putri'}. Pengampu asrama yang mencatat setoran malam kelompok ini.</DialogDescription>
      </DialogHeader>
      <label>
        <span className={LABEL}>Nama kelompok</span>
        <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Kelompok Al-Fatihah" className="h-10" />
      </label>
      <label>
        <span className={LABEL}>Pengampu asrama</span>
        <select value={pengampu} onChange={e => setPengampu(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
          <option value="">— belum ditetapkan —</option>
          {guru.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select>
      </label>
      <Kaki tutup={tutup} pending={pending}>
        <Button disabled={pending || !nama.trim()}
          onClick={() => kirim(() => simpanKelompokAction({ id: kelompok?.id, nama, gender, pengampu_id: pengampu || null }), kelompok ? 'Kelompok disimpan.' : 'Kelompok dibuat.')}>
          {kelompok ? 'Simpan' : 'Buat kelompok'}
        </Button>
      </Kaki>
    </>
  )
}
