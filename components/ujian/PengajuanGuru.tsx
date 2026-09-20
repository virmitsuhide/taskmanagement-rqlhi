'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  formatJadwalSingkat, formatTahsinLevels, formatTanggalSingkat,
  getPredikatClass, getPredikatLabel, getStatusLabel, getStatusVariant, getTahfidzLabel,
} from '@/lib/rq/ujian'
import { deleteTahfidzUjianAction, deleteTahsinUjianAction } from '@/app/actions/ujian'
import type { TahfidzTipe, UjianStatus, UjianTahfidz, UjianTahsin } from '@/types'

interface Props {
  /** Guru yang sedang masuk — hanya pengajuannya sendiri yang bisa ditarik. */
  teacherId: string
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
}

type Sasaran =
  | { jenis: 'tahfidz'; id: string; nama: string }
  | { jenis: 'tahsin'; id: string; nama: string }

type Jenis = 'tahfidz' | 'tahsin'

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const STATUS: { kode: UjianStatus | 'semua'; label: string }[] = [
  { kode: 'semua', label: 'Semua' },
  { kode: 'diajukan', label: 'Diajukan' },
  { kode: 'dijadwalkan', label: 'Dijadwalkan' },
  { kode: 'selesai', label: 'Selesai' },
]

const TIPE_TAHFIDZ: { kode: TahfidzTipe; label: string }[] = [
  { kode: '1_juz', label: '1 Juz' },
  { kode: '3_juz', label: '3 Juz' },
  { kode: '5_juz', label: '5 Juz' },
]

/**
 * Bulan yang memiliki sebuah ujian.
 *
 * Ujian yang SUDAH dijadwalkan masuk ke bulan pelaksanaannya; yang belum
 * masuk ke bulan pengajuannya. Guru yang membuka "September" bertanya
 * "ujian apa saja bulan ini" — dan bagi ujian yang sudah punya tanggal,
 * yang ia maksud tanggal ujiannya, bukan kapan formulirnya dikirim.
 */
function bulanDari(item: { jadwal: string | null; created_at: string }): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(new Date(item.jadwal ?? item.created_at))
    .slice(0, 7)
}

/**
 * Daftar pengajuan & riwayat ujian milik seorang guru.
 *
 * Guru tidak menjadwalkan dan tidak menilai — itu wewenang koordinator —
 * jadi di sini semuanya hanya bisa dibaca. Satu-satunya tindakan adalah
 * menarik kembali pengajuan yang belum dijadwalkan.
 *
 * Bawaannya BULAN BERJALAN. Daftar yang menampilkan seluruh riwayat sejak
 * dulu membuat ujian pekan ini terkubur di antara ratusan baris lama;
 * yang ditanyakan guru hampir selalu "bagaimana yang bulan ini".
 */
export function PengajuanGuru({ teacherId, tahfidz, tahsin }: Props) {
  const router = useRouter()
  const [sasaran, setSasaran] = useState<Sasaran | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  // Tab dibuka pada jenis yang paling banyak dimiliki guru ini — pengampu
  // tahsin murni tidak perlu disambut tab tahfidz yang kosong.
  const [jenis, setJenis] = useState<Jenis>(tahsin.length > tahfidz.length ? 'tahsin' : 'tahfidz')
  const [status, setStatus] = useState<UjianStatus | 'semua'>('semua')
  const [tipe, setTipe] = useState<string>('semua')
  /** null = semua bulan. */
  const [bulan, setBulan] = useState<string | null>(
    () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
      .format(new Date()).slice(0, 7),
  )

  const semua = useMemo(
    () => (jenis === 'tahfidz' ? tahfidz : tahsin) as (UjianTahfidz | UjianTahsin)[],
    [jenis, tahfidz, tahsin],
  )

  /** Bulan yang benar-benar punya ujian, terbaru dulu — isi pilihan periode. */
  const bulanTersedia = useMemo(() => {
    const set = new Set<string>([...tahfidz, ...tahsin].map(bulanDari))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [tahfidz, tahsin])

  const tahunTersedia = useMemo(
    () => [...new Set(bulanTersedia.map(b => b.slice(0, 4)))].sort((a, b) => b.localeCompare(a)),
    [bulanTersedia],
  )

  const tipePilihan = useMemo(() => {
    if (jenis === 'tahfidz') return TIPE_TAHFIDZ.map(t => ({ kode: t.kode as string, label: t.label }))
    const level = [...new Set(tahsin.map(t => t.level).filter(Boolean))].sort()
    return level.map(l => ({ kode: l, label: l }))
  }, [jenis, tahsin])

  const diBulan = useMemo(
    () => (bulan === null ? semua : semua.filter(i => bulanDari(i) === bulan)),
    [semua, bulan],
  )

  const tampil = useMemo(
    () => diBulan
      .filter(i => {
        if (status !== 'semua' && i.status !== status) return false
        if (tipe === 'semua') return true
        return 'tipe' in i ? i.tipe === tipe : i.level === tipe
      })
      // Terbaru dulu, memakai KUNCI YANG SAMA dengan penyaring bulan: ujian
      // berjadwal diurutkan menurut tanggal ujiannya, yang belum menurut
      // tanggal pengajuannya. Mengurutkan dengan kunci lain membuat daftar
      // satu bulan tampak teracak tanpa sebab yang kelihatan.
      .sort((a, b) => (b.jadwal ?? b.created_at).localeCompare(a.jadwal ?? a.created_at)),
    [diBulan, status, tipe],
  )

  const hitungStatus = (k: UjianStatus | 'semua') =>
    k === 'semua' ? diBulan.length : diBulan.filter(i => i.status === k).length
  const hitungTipe = (k: string) =>
    k === 'semua'
      ? diBulan.length
      : diBulan.filter(i => ('tipe' in i ? i.tipe === k : i.level === k)).length

  function tarik() {
    if (!sasaran) return
    startTransition(async () => {
      const hasil = sasaran.jenis === 'tahfidz'
        ? await deleteTahfidzUjianAction(sasaran.id)
        : await deleteTahsinUjianAction(sasaran.id)
      setSasaran(null)
      if (hasil.error) setError(hasil.error)
      router.refresh()
    })
  }

  function gantiJenis(j: Jenis) {
    setJenis(j)
    // Tipe milik jenis lama tidak punya arti di jenis baru — "3 Juz" bukan
    // level tahsin mana pun, dan menyisakannya membuat daftar kosong tanpa
    // sebab yang kelihatan.
    setTipe('semua')
  }

  if (tahfidz.length === 0 && tahsin.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-14 text-center">
        <ClipboardList className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Belum ada ujian untuk anak halaqoh Anda</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pengajuan Anda — atau yang diajukan koordinator untuk anak Anda — akan muncul di
          sini beserta jadwal dan hasilnya.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Jenis ujian ── */}
      <div className="flex gap-1.5" role="group" aria-label="Jenis ujian">
        {([
          { kode: 'tahfidz' as const, label: 'Tahfidz', n: tahfidz.length },
          { kode: 'tahsin' as const, label: 'Tahsin', n: tahsin.length },
        ]).map(t => (
          <button
            key={t.kode}
            type="button"
            aria-pressed={jenis === t.kode}
            onClick={() => gantiJenis(t.kode)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-none',
              jenis === t.kode ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
            )}
          >
            {t.label} <span className="font-normal text-muted-foreground">({t.n})</span>
          </button>
        ))}
      </div>

      {/* ── Periode ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <select
          aria-label="Bulan"
          value={bulan?.slice(5, 7) ?? ''}
          disabled={bulan === null}
          onChange={e => setBulan(`${bulan?.slice(0, 4) ?? tahunTersedia[0]}-${e.target.value}`)}
          className="h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {BULAN_ID.map((b, i) => (
            <option key={b} value={String(i + 1).padStart(2, '0')}>{b}</option>
          ))}
        </select>

        <select
          aria-label="Tahun"
          value={bulan?.slice(0, 4) ?? ''}
          disabled={bulan === null}
          onChange={e => setBulan(`${e.target.value}-${bulan?.slice(5, 7) ?? '01'}`)}
          className="h-9 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {[...new Set([...tahunTersedia, String(new Date().getFullYear())])]
            .sort((a, b) => b.localeCompare(a))
            .map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <button
          type="button"
          aria-pressed={bulan === null}
          onClick={() => setBulan(bulan === null ? bulanTersedia[0] ?? null : null)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition-colors',
            bulan === null ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
          )}
        >
          Semua bulan
        </button>

        <span className="ml-auto text-xs text-muted-foreground">
          {tampil.length} dari {semua.length} ujian {jenis}
        </span>
      </div>

      {/* ── Status & tipe ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status ujian">
          {STATUS.map(s => (
            <Chip key={s.kode} aktif={status === s.kode} n={hitungStatus(s.kode)}
              onClick={() => setStatus(s.kode)}>
              {s.label}
            </Chip>
          ))}
        </div>

        {tipePilihan.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jenis ujian rinci">
            <Chip aktif={tipe === 'semua'} n={hitungTipe('semua')} onClick={() => setTipe('semua')}>
              {jenis === 'tahfidz' ? 'Semua tipe' : 'Semua level'}
            </Chip>
            {tipePilihan.map(t => (
              <Chip key={t.kode} aktif={tipe === t.kode} n={hitungTipe(t.kode)} onClick={() => setTipe(t.kode)}>
                {t.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* ── Daftar ── */}
      {tampil.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm font-medium">Tidak ada ujian {jenis} yang cocok</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {bulan !== null && semua.length > 0
              ? `Ada ${semua.length} ujian ${jenis} di bulan lain — ketuk "Semua bulan" untuk melihatnya.`
              : 'Longgarkan penyaring status atau tipenya.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tampil.map(item => ('tipe' in item ? (
            <Kartu
              key={item.id}
              judul={item.nama_siswa}
              rincian={`Kelas ${item.kelas} · ${getTahfidzLabel(item.tipe, item.juz)}`}
              status={item.status}
              jadwal={item.jadwal}
              penguji={item.penguji}
              dibuat={item.created_at}
              olehLain={item.created_by_teacher === teacherId ? null : item.created_by_user ? 'koordinator' : 'guru lain'}
              hasil={item.predikat ? getPredikatLabel(item.predikat) : null}
              hasilKelas={getPredikatClass(item.predikat)}
              onTarik={item.status === 'diajukan' && item.created_by_teacher === teacherId
                ? () => setSasaran({ jenis: 'tahfidz', id: item.id, nama: item.nama_siswa })
                : undefined}
            />
          ) : (
            <Kartu
              key={item.id}
              judul={item.nama_kelompok}
              rincian={`${formatTahsinLevels(item)} · ${item.siswa.length} siswa · Sesi ${item.sesi}`}
              status={item.status}
              jadwal={item.jadwal}
              penguji={item.penguji}
              dibuat={item.created_at}
              olehLain={item.created_by_teacher === teacherId ? null : item.created_by_user ? 'koordinator' : 'guru lain'}
              hasil={item.status === 'selesai'
                ? `${item.siswa.filter(s => s.predikat === 'lulus').length}/${item.siswa.length} lulus`
                : null}
              hasilKelas="text-success font-medium"
              onTarik={item.status === 'diajukan' && item.created_by_teacher === teacherId
                ? () => setSasaran({ jenis: 'tahsin', id: item.id, nama: item.nama_kelompok })
                : undefined}
            />
          )))}
        </ul>
      )}

      <Dialog open={Boolean(sasaran)} onOpenChange={open => !open && setSasaran(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarik pengajuan?</DialogTitle>
            <DialogDescription>
              Pengajuan <span className="font-medium text-foreground">{sasaran?.nama}</span> akan
              dihapus dari antrian. Anda bisa mengajukannya kembali kapan saja.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1"
              onClick={() => setSasaran(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant="destructive" size="lg" className="flex-1"
              onClick={tarik} disabled={pending}>
              {pending ? 'Menarik…' : 'Ya, tarik'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Penyaring satu ketukan, dengan jumlahnya — nol pun tetap tampil supaya
 *  guru tahu penyaringnya ada dan memang sedang kosong. */
function Chip({ aktif, n, onClick, children }: {
  aktif: boolean
  n: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        aktif ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
        !aktif && n === 0 && 'text-muted-foreground',
      )}
    >
      {children} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  )
}

function Kartu({
  judul, rincian, status, jadwal, penguji, dibuat, olehLain, hasil, hasilKelas, onTarik,
}: {
  judul: string
  rincian: string
  status: UjianTahfidz['status']
  jadwal: string | null
  penguji: string | null
  dibuat: string
  olehLain: string | null
  hasil: string | null
  hasilKelas: string
  onTarik?: () => void
}) {
  return (
    <li className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{judul}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{rincian}</p>
        </div>
        <Badge variant={getStatusVariant(status)} className="shrink-0">
          {getStatusLabel(status)}
        </Badge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-xs text-muted-foreground">
        <span className={jadwal ? 'text-foreground' : undefined}>
          {formatJadwalSingkat(jadwal)}
        </span>
        <span>·</span>
        <span>{penguji || 'Penguji belum ditentukan'}</span>
        {hasil && (
          <>
            <span>·</span>
            <span className={cn(hasilKelas)}>{hasil}</span>
          </>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5">
        <span className="text-xs text-muted-foreground">
          Diajukan {formatTanggalSingkat(dibuat)}{olehLain ? ` oleh ${olehLain}` : ''}
        </span>
        {onTarik && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onTarik}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Tarik
          </Button>
        )}
      </div>
    </li>
  )
}
