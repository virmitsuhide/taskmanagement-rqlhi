'use client'

import { CalendarClock, CheckCircle2, Inbox, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatTahsinLevels, getPredikatClass, getPredikatLabel, getTahfidzKategori,
  getTahfidzLabel, tanggalWIB,
} from '@/lib/rq/ujian'
import type { UjianStatus, UjianTahfidz, UjianTahsin } from '@/types'

/**
 * Papan tiga kolom untuk halaman Kelola Ujian: Diajukan → Terjadwal → Selesai.
 *
 * Murni penataan ulang data yang sudah dimuat KelolaUjian — tidak ada query
 * atau aksi baru. Tombol di kartu membuka dialog kelola yang sama dengan
 * tampilan daftar, jadi aturan penjadwalan & penilaian tetap di satu tempat.
 */

export type KartuUjian =
  | { jenis: 'tahfidz'; item: UjianTahfidz }
  | { jenis: 'tahsin'; item: UjianTahsin }

interface Props {
  kartu: KartuUjian[]
  namaPengaju: Record<string, string>
  onKelola: (k: KartuUjian) => void
  /** Pindah ke tampilan daftar dengan penyaring status tertentu. */
  onLihatSemua: (status: UjianStatus) => void
}

const BATAS_KOLOM = 6

function kunciPengaju(item: { created_by_teacher: string | null; created_by_user: string | null }) {
  if (item.created_by_teacher) return `teacher:${item.created_by_teacher}`
  if (item.created_by_user) return `user:${item.created_by_user}`
  return null
}

function inisial(nama: string): string {
  const kata = nama.replace(/^(Ust\.?|Ustzh\.?|Ustadz|Ustadzah)\s+/i, '').trim().split(/\s+/)
  return ((kata[0]?.[0] ?? '') + (kata[1]?.[0] ?? '')).toUpperCase() || '?'
}

function berapaLama(iso: string): string {
  const hari = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (hari <= 0) return 'hari ini'
  if (hari === 1) return 'kemarin'
  if (hari < 30) return `${hari} hari lalu`
  return `${Math.floor(hari / 30)} bulan lalu`
}

function labelHari(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta',
  })
}

function jam(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  })
}

function judul(k: KartuUjian): string {
  return k.jenis === 'tahfidz' ? k.item.nama_siswa : k.item.nama_kelompok
}

function keterangan(k: KartuUjian): string {
  if (k.jenis === 'tahfidz') {
    return `${k.item.unit} · Kelas ${k.item.kelas} · ${getTahfidzLabel(k.item.tipe, k.item.juz)}`
  }
  return `${k.item.unit} · ${formatTahsinLevels(k.item)} · ${k.item.siswa.length} siswa`
}

function waktuSelesai(k: KartuUjian): string {
  return k.item.selesai_at ?? k.item.jadwal ?? k.item.updated_at
}

export function PapanUjian({ kartu, namaPengaju, onKelola, onLihatSemua }: Props) {
  const diajukan = kartu
    .filter(k => k.item.status === 'diajukan')
    .sort((a, b) => a.item.created_at.localeCompare(b.item.created_at))
  const terjadwal = kartu
    .filter(k => k.item.status === 'dijadwalkan')
    .sort((a, b) => (a.item.jadwal ?? '9999').localeCompare(b.item.jadwal ?? '9999'))
  const selesai = kartu
    .filter(k => k.item.status === 'selesai')
    .sort((a, b) => waktuSelesai(b).localeCompare(waktuSelesai(a)))

  const hariIni = tanggalWIB(new Date())

  // Kelompokkan yang terjadwal per tanggal WIB; yang belum punya jadwal
  // (data lama) dikumpulkan di akhir.
  const perTanggal = new Map<string, KartuUjian[]>()
  for (const k of terjadwal.slice(0, BATAS_KOLOM + 2)) {
    const t = k.item.jadwal ? tanggalWIB(k.item.jadwal) : 'tanpa-jadwal'
    perTanggal.set(t, [...(perTanggal.get(t) ?? []), k])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Diajukan ── */}
      <Kolom judul="Diajukan" jumlah={diajukan.length} nada="warning" icon={<Inbox className="h-4 w-4" />}>
        {diajukan.length === 0 && <KolomKosong teks="Tidak ada pengajuan yang menunggu." />}
        {diajukan.slice(0, BATAS_KOLOM).map(k => {
          const kunci = kunciPengaju(k.item)
          return (
            <li key={k.item.id} className="rounded-xl border bg-card p-3.5">
              <div className="flex items-start gap-3">
                <Avatar nama={judul(k)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{judul(k)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{keterangan(k)}</p>
                </div>
                <JenisBadge k={k} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {kunci && namaPengaju[kunci] ? `${namaPengaju[kunci]} · ` : ''}{berapaLama(k.item.created_at)}
                </span>
                <Button size="sm" className="h-8 shrink-0" onClick={() => onKelola(k)}>
                  Jadwalkan
                </Button>
              </div>
            </li>
          )
        })}
        {diajukan.length > BATAS_KOLOM && (
          <LihatSemua jumlah={diajukan.length - BATAS_KOLOM} onClick={() => onLihatSemua('diajukan')} />
        )}
      </Kolom>

      {/* ── Terjadwal ── */}
      <Kolom judul="Terjadwal" jumlah={terjadwal.length} nada="info" icon={<CalendarClock className="h-4 w-4" />}>
        {terjadwal.length === 0 && <KolomKosong teks="Belum ada ujian yang dijadwalkan." />}
        {[...perTanggal.entries()].map(([tanggal, isi]) => {
          const lewat = tanggal !== 'tanpa-jadwal' && tanggal < hariIni
          return (
            <li key={tanggal} className="space-y-2">
              <p className={cn(
                'px-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
                lewat ? 'text-warning' : 'text-muted-foreground',
              )}>
                {tanggal === 'tanpa-jadwal' ? 'Tanpa tanggal' : labelHari(tanggal)}
                {tanggal === hariIni && ' · hari ini'}
                {lewat && ' · belum dinilai'}
              </p>
              {isi.map(k => (
                <div key={k.item.id} className="flex gap-3 rounded-xl border bg-card p-3.5">
                  <span className="w-11 shrink-0 font-display text-lg leading-tight tabular-nums text-primary">
                    {k.item.jadwal ? jam(k.item.jadwal) : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{judul(k)}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{keterangan(k)}</p>
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Penguji </span>
                      <span className={k.item.penguji ? 'font-medium' : 'text-warning'}>
                        {k.item.penguji || 'belum ditentukan'}
                      </span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 shrink-0 self-center" onClick={() => onKelola(k)}>
                    {lewat ? 'Nilai' : 'Kelola'}
                  </Button>
                </div>
              ))}
            </li>
          )
        })}
        {terjadwal.length > BATAS_KOLOM + 2 && (
          <LihatSemua jumlah={terjadwal.length - (BATAS_KOLOM + 2)} onClick={() => onLihatSemua('dijadwalkan')} />
        )}
      </Kolom>

      {/* ── Selesai ── */}
      <Kolom judul="Selesai" jumlah={selesai.length} nada="success" icon={<CheckCircle2 className="h-4 w-4" />}>
        {selesai.length === 0 && <KolomKosong teks="Belum ada ujian yang selesai." />}
        {selesai.slice(0, BATAS_KOLOM).map(k => (
          <li key={k.item.id}>
            <button
              onClick={() => onKelola(k)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{judul(k)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{keterangan(k)}</p>
              </div>
              <Hasil k={k} />
            </button>
          </li>
        ))}
        {selesai.length > BATAS_KOLOM && (
          <LihatSemua jumlah={selesai.length - BATAS_KOLOM} onClick={() => onLihatSemua('selesai')} />
        )}
      </Kolom>
    </div>
  )
}

function Hasil({ k }: { k: KartuUjian }) {
  if (k.jenis === 'tahfidz') {
    return (
      <span className={cn('shrink-0 text-xs', getPredikatClass(k.item.predikat))}>
        {k.item.predikat ? getPredikatLabel(k.item.predikat) : 'Belum dinilai'}
      </span>
    )
  }
  const lulus = k.item.siswa.filter(s => s.predikat === 'lulus').length
  const ulang = k.item.siswa.filter(s => s.predikat === 'mengulang').length
  return (
    <span className="shrink-0 text-right text-xs">
      <span className="font-semibold text-success">{lulus} lulus</span>
      {ulang > 0 && <span className="block text-destructive">{ulang} mengulang</span>}
    </span>
  )
}

function JenisBadge({ k }: { k: KartuUjian }) {
  if (k.jenis === 'tahsin') return <Badge variant="info" className="shrink-0">Tahsin</Badge>
  const tasmi = getTahfidzKategori(k.item.tipe) === 'tasmi'
  return (
    <Badge variant={tasmi ? 'warning' : 'success'} className="shrink-0">
      {tasmi ? "Tasmi'" : 'Tahfidz'}
    </Badge>
  )
}

function Avatar({ nama }: { nama: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {inisial(nama)}
    </span>
  )
}

function Kolom({
  judul, jumlah, nada, icon, children,
}: {
  judul: string
  jumlah: number
  nada: 'warning' | 'info' | 'success'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const warna = {
    warning: 'text-warning',
    info: 'text-info',
    success: 'text-success',
  }[nada]
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-muted/60 p-3">
      <header className="flex items-center justify-between px-1.5 pb-3 pt-1">
        <h3 className={cn('flex items-center gap-2 text-sm font-semibold', warna)}>
          {icon}
          <span className="text-foreground">{judul}</span>
        </h3>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">{jumlah}</span>
      </header>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function KolomKosong({ teks }: { teks: string }) {
  return (
    <li className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
      {teks}
    </li>
  )
}

function LihatSemua({ jumlah, onClick }: { jumlah: number; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full rounded-xl px-3 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        +{jumlah} lainnya · lihat di daftar
      </button>
    </li>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panel samping: beban penguji dua pekan ke depan.
 * Hanya menghitung ujian berstatus "dijadwalkan" yang sudah punya penguji.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Batas tasmi' per penguji per pekan — hanya penanda warna, TIDAK memblokir
 * penjadwalan. Ubah angkanya di sini bila aturannya berbeda.
 */
export const BATAS_TASMI_PEKANAN = 4

export function BebanPenguji({ tahfidz, tahsin }: { tahfidz: UjianTahfidz[]; tahsin: UjianTahsin[] }) {
  const sekarang = Date.now()
  const dalam = (iso: string | null, hari: number) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= sekarang - 86_400_000 && t <= sekarang + hari * 86_400_000
  }

  const peta = new Map<string, { tahfidz: number; tahsin: number; tasmiPekanIni: number }>()
  const ambil = (nama: string) => {
    const ada = peta.get(nama)
    if (ada) return ada
    const baru = { tahfidz: 0, tahsin: 0, tasmiPekanIni: 0 }
    peta.set(nama, baru)
    return baru
  }
  for (const t of tahfidz) {
    if (t.status !== 'dijadwalkan' || !t.penguji || !dalam(t.jadwal, 14)) continue
    const p = ambil(t.penguji)
    p.tahfidz++
    if (getTahfidzKategori(t.tipe) === 'tasmi' && dalam(t.jadwal, 7)) p.tasmiPekanIni++
  }
  for (const t of tahsin) {
    if (t.status !== 'dijadwalkan' || !t.penguji || !dalam(t.jadwal, 14)) continue
    ambil(t.penguji).tahsin++
  }
  const baris = [...peta.entries()].sort((a, b) =>
    (b[1].tahfidz + b[1].tahsin) - (a[1].tahfidz + a[1].tahsin))

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="font-display text-lg leading-tight">Beban penguji</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Ujian terjadwal dua pekan ke depan</p>
      {baris.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Belum ada penguji yang terjadwal.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {baris.map(([nama, b]) => {
            const penuh = b.tasmiPekanIni >= BATAS_TASMI_PEKANAN
            return (
              <li key={nama} className="flex items-center gap-3">
                <span className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                  penuh ? 'bg-accent-warm/15 text-accent-warm' : 'bg-primary/10 text-primary',
                )}>
                  {inisial(nama)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {[b.tahfidz ? `Tahfidz ${b.tahfidz}` : '', b.tahsin ? `Tahsin ${b.tahsin}` : '']
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={cn(
                  'font-display text-xl tabular-nums',
                  penuh ? 'text-accent-warm' : 'text-foreground',
                )}>
                  {b.tahfidz + b.tahsin}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-5 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Catatan jadwal</p>
        Penguji berwarna oranye sudah memegang {BATAS_TASMI_PEKANAN} tasmi&apos; atau lebih pekan ini.
        Ini hanya penanda — penjadwalan tetap bisa dilakukan.
      </div>
    </section>
  )
}
