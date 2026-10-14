'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftRight, CircleAlert, Clock, FileText, Gauge, LogOut, MoreHorizontal, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { hapusKelompokAction, keluarkanAnggotaAction, ubahLevelAction } from '@/app/actions/asrama'
import { akhiriCutiAction, batalkanPengajuanAction } from '@/app/actions/asrama-status'
import { LencanaLevel } from '@/components/asrama/LencanaLevel'
import {
  DialogAsrama, type Calon, type Guru, type KeadaanDialog,
} from '@/components/asrama/DialogAsrama'
import { LABEL_LEVEL, URUTAN_LEVEL, type LevelAsrama } from '@/lib/rq/asrama'
import type { AnggotaAsrama, KelompokAsrama } from '@/lib/data/asrama'
import type { CutiAnggota, PengajuanNonaktif } from '@/lib/data/asrama-status'
import { LABEL_ALASAN, LABEL_CUTI, LABEL_STATUS_PENGAJUAN, tglPendek } from '@/lib/rq/asrama-status'
import { cn } from '@/lib/utils'

export function inisial(nama: string | null | undefined): string {
  if (!nama) return '—'
  const kata = nama.replace(/^(ust(adz|adzah|zh)?\.?|ustz\.?)\s+/i, '').split(/\s+/).filter(Boolean)
  return (kata[0]?.[0] ?? '').concat(kata[1]?.[0] ?? '').toUpperCase() || '—'
}

const CHIP = 'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors'
const CHIP_AKTIF = 'border-primary bg-primary text-primary-foreground'
const CHIP_PASIF = 'bg-card hover:bg-accent'

const WARNA_STATUS: Record<string, string> = {
  menunggu: 'bg-accent-warm-wash text-accent-warm',
  disetujui: 'bg-success-wash text-success',
  ditolak: 'bg-destructive-wash text-destructive',
}

export function LencanaStatus({ status, children }: { status: string; children?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-bold', WARNA_STATUS[status] ?? 'bg-muted')}>
      {children ?? LABEL_STATUS_PENGAJUAN[status as keyof typeof LABEL_STATUS_PENGAJUAN]}
    </span>
  )
}

function namaPendek(n: string) {
  return n.split(' ').slice(0, 2).join(' ')
}

/**
 * Tab "Kelompok & level" halaman Halaqoh Asrama — kartu kelompok dengan menu
 * aksi per anak (pindah, level, cuti, ajukan nonaktif, keluarkan), daftar
 * cuti dan pengajuan nonaktif.
 */
export function PapanAsrama({ gender, kelompok, calon, cuti, pengajuan, guru, bisaUbah, bisaVerifikasi }: {
  gender: 'L' | 'P'
  kelompok: KelompokAsrama[]
  calon: Calon[]
  cuti: Record<string, CutiAnggota>
  pengajuan: PengajuanNonaktif[]
  guru: Guru[]
  bisaUbah: boolean
  bisaVerifikasi: boolean
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [cari, setCari] = useState('')
  const [level, setLevel] = useState<LevelAsrama | 'semua'>('semua')
  const [dialog, setDialog] = useState<KeadaanDialog | null>(null)

  const anak = kelompok.reduce((n, k) => n + k.anggota.length, 0)
  const anggotaIds = new Set(kelompok.flatMap(k => k.anggota.map(a => a.student_id)))
  const cutiDiSini = Object.values(cuti).filter(c => anggotaIds.has(c.student_id))
  const menunggu = pengajuan.filter(p => p.status === 'menunggu')
  const statusAnak = useMemo(() => {
    const m = new Map<string, PengajuanNonaktif>()
    for (const p of pengajuan) {
      if (p.status === 'menunggu' || (p.status === 'disetujui' && !p.diterapkan_at)) m.set(p.student_id, p)
    }
    return m
  }, [pengajuan])
  const namaKelompok = new Map<string, string>()
  for (const k of kelompok) for (const a of k.anggota) namaKelompok.set(a.student_id, k.nama)

  function jalankan(aksi: () => Promise<{ error?: string }>, sukses: string) {
    startTransition(async () => {
      const r = await aksi()
      if (r.error) { toast.error(r.error); return }
      toast.success(sukses)
      router.refresh()
    })
  }

  async function keluarkan(a: AnggotaAsrama, k: KelompokAsrama) {
    const ok = await confirm({
      title: `Keluarkan ${namaPendek(a.nama)} dari ${k.nama}?`,
      description: 'Anak kembali "belum berkelompok" dan masih anak boarding. Riwayat setoran tidak terhapus. Untuk anak yang berhenti dari asrama, pakai "Ajukan nonaktif ke Koor SMP".',
      confirmText: 'Keluarkan',
    })
    if (ok) jalankan(() => keluarkanAnggotaAction(a.student_id), `${namaPendek(a.nama)} dikeluarkan dari kelompok.`)
  }

  async function hapusKelompok(k: KelompokAsrama) {
    const ok = await confirm({
      title: `Hapus kelompok "${k.nama}"?`,
      description: `${k.anggota.length} anggotanya kembali belum berkelompok. Riwayat setoran tidak terhapus.`,
      confirmText: 'Hapus kelompok',
    })
    if (ok) jalankan(() => hapusKelompokAction(k.id), 'Kelompok dihapus.')
  }

  const kata = cari.trim().toLowerCase()
  const menyaring = kata !== '' || level !== 'semua'
  const cocok = (a: AnggotaAsrama) =>
    (!kata || a.nama.toLowerCase().includes(kata) || (a.kelas ?? '').toLowerCase().includes(kata))
    && (level === 'semua' || a.level === level)

  return (
    <div className="space-y-5">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ubin label="Anak asrama aktif" angka={anak} ket={`${gender === 'L' ? 'Putra' : 'Putri'} · SMPIT boarding`} />
        <Ubin label="Kelompok" angka={kelompok.length} ket={kelompok.length ? `rata-rata ${Math.round(anak / kelompok.length)} anak` : 'belum ada'} />
        <Ubin label="Belum berkelompok" angka={calon.length} ket={calon.length ? 'perlu dimasukkan' : 'semua sudah masuk'} warna={calon.length ? 'text-accent-warm' : undefined} />
        <Ubin label="Cuti & pengajuan" angka={`${cutiDiSini.length} · ${menunggu.length}`} ket="cuti · menunggu Koor SMP" />
      </div>

      {/* Belum berkelompok */}
      {calon.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-accent-warm/30 bg-accent-warm-wash p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-warm" />
            <div>
              <p className="font-bold text-accent-warm">{calon.length} anak boarding belum masuk kelompok</p>
              <p className="text-xs text-muted-foreground">Mereka belum punya pengampu asrama — setoran asramanya belum bisa dicatat.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {calon.slice(0, bisaUbah ? 6 : 10).map(c => (
              <span key={c.id} className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-3 pr-1 text-sm font-semibold">
                {namaPendek(c.nama)}{c.kelas ? <span className="font-normal text-muted-foreground">· {c.kelas}</span> : null}
                {bisaUbah && kelompok.length > 0 ? (
                  <button type="button" onClick={() => setDialog({ jenis: 'masukkan', siswa: { id: c.id, nama: c.nama, kelas: c.kelas } })}
                    className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90">
                    Masukkan
                  </button>
                ) : <span className="pr-2" />}
              </span>
            ))}
            {calon.length > (bisaUbah ? 6 : 10) && <span className="self-center text-xs text-muted-foreground">+{calon.length - (bisaUbah ? 6 : 10)} lagi</span>}
          </div>
        </div>
      )}

      {/* Alat */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari anak di semua kelompok" className="h-9 pl-9" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['semua', ...URUTAN_LEVEL] as const).map(l => (
            <button key={l} type="button" onClick={() => setLevel(l)} aria-pressed={level === l}
              className={cn(CHIP, level === l ? CHIP_AKTIF : CHIP_PASIF)}>
              {l === 'semua' ? 'Semua level' : LABEL_LEVEL[l]}
            </button>
          ))}
        </div>
        {bisaUbah && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setDialog({ jenis: 'kelompok' })}><Plus className="h-4 w-4" />Kelompok baru</Button>
            {kelompok.length > 0 && (
              <Button onClick={() => setDialog({ jenis: 'tambah', kelompokId: null })}><Plus className="h-4 w-4" />Tambah anak</Button>
            )}
          </div>
        )}
      </div>

      {kelompok.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kelompok {gender === 'L' ? 'putra' : 'putri'}.</p>}

      {/* Kelompok */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kelompok.map(k => {
          const tampil = k.anggota.filter(cocok)
          if (menyaring && tampil.length === 0) return null
          const perLevel = URUTAN_LEVEL.map(l => ({ l, n: k.anggota.filter(a => a.level === l).length })).filter(x => x.n > 0)
          return (
            <section key={k.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-start gap-3 border-b p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-wash text-sm font-bold text-primary">{inisial(k.pengampu_nama ?? k.nama)}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-lg leading-tight">{k.nama}</h2>
                  <p className="text-xs text-muted-foreground">
                    {k.pengampu_nama ? `Pengampu ${k.pengampu_nama}` : <span className="text-accent-warm">Pengampu belum ditetapkan</span>} · {k.anggota.length} anak
                  </p>
                  {perLevel.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{perLevel.map(x => `${LABEL_LEVEL[x.l]} ${x.n}`).join(' · ')}</p>}
                </div>
                {bisaUbah && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm" aria-label={`Menu ${k.nama}`}><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={() => setDialog({ jenis: 'kelompok', kelompok: k })}><Pencil />Ubah nama & pengampu</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialog({ jenis: 'tambah', kelompokId: k.id })}><Plus />Tambah anak</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => hapusKelompok(k)}><Trash2 />Hapus kelompok</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {k.anggota.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Belum ada anggota.</p>}
              <ul>
                {tampil.map(a => {
                  const c = cuti[a.student_id]
                  const p = statusAnak.get(a.student_id)
                  return (
                    <li key={a.student_id} className="flex items-center gap-2 border-b px-4 py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <Link href={`/siswa/${a.student_id}`} className="font-bold hover:underline">{a.nama}</Link>
                          {a.kelas && <span className="text-muted-foreground"> · {a.kelas}</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Sekolah: {a.pengampu_sekolah.length ? a.pengampu_sekolah.join(', ') : '—'}{a.halaqoh_sekolah ? ` · ${a.halaqoh_sekolah}` : ''}
                        </p>
                        {(c || p) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c && <span className="rounded-md bg-info-wash px-2 py-0.5 text-[11px] font-bold text-info">{c.jenis === 'sakit' ? 'Cuti sakit' : 'Cuti keluarga'} · sejak {tglPendek(c.sejak)}</span>}
                            {p && (
                              <LencanaStatus status={p.status}>
                                {p.status === 'menunggu'
                                  ? `Menunggu verifikasi · ${LABEL_ALASAN[p.alasan].toLowerCase()}`
                                  : `Disetujui · keluar ${tglPendek(p.tanggal_efektif)}`}
                              </LencanaStatus>
                            )}
                          </div>
                        )}
                      </div>
                      <LencanaLevel level={a.level} className="px-2 py-0.5 text-[11px]" />
                      {bisaUbah && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" disabled={pending} aria-label={`Aksi untuk ${a.nama}`}><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            {kelompok.length > 1 && (
                              <DropdownMenuItem onSelect={() => setDialog({ jenis: 'pindah', siswa: { id: a.student_id, nama: a.nama, kelas: a.kelas }, dariId: k.id, level: a.level })}>
                                <ArrowLeftRight />Pindah kelompok
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger><Gauge className="size-4" />Ubah level</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup value={a.level ?? ''} onValueChange={v => jalankan(() => ubahLevelAction(a.student_id, v || null), `Level ${namaPendek(a.nama)} disimpan.`)}>
                                  {URUTAN_LEVEL.map(l => <DropdownMenuRadioItem key={l} value={l}>{LABEL_LEVEL[l]}</DropdownMenuRadioItem>)}
                                  <DropdownMenuRadioItem value="">Belum ditetapkan</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {c ? (
                              <DropdownMenuItem className="text-info" onSelect={() => jalankan(() => akhiriCutiAction(a.student_id), `Cuti ${namaPendek(a.nama)} diakhiri.`)}>
                                <Clock />Akhiri cuti
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-info" onSelect={() => setDialog({ jenis: 'cuti', siswa: { id: a.student_id, nama: a.nama, kelas: a.kelas } })}>
                                <Clock />Tandai cuti / sakit
                              </DropdownMenuItem>
                            )}
                            {p?.status === 'menunggu' ? (
                              <DropdownMenuItem className="text-accent-warm" onSelect={() => jalankan(() => batalkanPengajuanAction(p.id), 'Pengajuan dibatalkan.')}>
                                <FileText />Batalkan pengajuan nonaktif
                              </DropdownMenuItem>
                            ) : !p && (
                              <DropdownMenuItem className="text-accent-warm" onSelect={() => setDialog({ jenis: 'nonaktif', siswa: { id: a.student_id, nama: a.nama, kelas: a.kelas }, kelompokNama: k.nama })}>
                                <FileText />Ajukan nonaktif ke Koor SMP
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => keluarkan(a, k)}><LogOut />Keluarkan dari kelompok</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </li>
                  )
                })}
              </ul>
              {bisaUbah && !menyaring && (
                <div className="p-3">
                  <button type="button" onClick={() => setDialog({ jenis: 'tambah', kelompokId: k.id })}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 py-2 text-sm font-bold text-primary hover:bg-primary-wash">
                    <Plus className="h-4 w-4" />Tambah anak ke kelompok ini
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Cuti & pengajuan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 border-b pb-3">
            <h2 className="font-heading text-xl">Cuti / sakit sementara</h2>
            <span className="text-xs text-muted-foreground">tanpa persetujuan · anak tetap di kelompoknya</span>
          </div>
          {cutiDiSini.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground">Tidak ada anak yang sedang cuti atau sakit.</p>
          ) : (
            <ul>
              {cutiDiSini.map(c => {
                const a = kelompok.flatMap(k => k.anggota).find(x => x.student_id === c.student_id)
                return (
                  <li key={c.student_id} className="flex items-center gap-3 border-b py-3 last:border-0">
                    <p className="w-36 shrink-0 text-sm font-bold">{a?.nama ?? '—'}{a?.kelas && <span className="font-normal text-muted-foreground"> · {a.kelas}</span>}</p>
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {LABEL_CUTI[c.jenis]}{c.catatan ? ` · ${c.catatan}` : ''} · sejak {tglPendek(c.sejak)}
                      {c.kembali ? ` · perkiraan kembali ${tglPendek(c.kembali)}` : ''} · {namaKelompok.get(c.student_id)}
                    </p>
                    {bisaUbah && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => jalankan(() => akhiriCutiAction(c.student_id), 'Cuti diakhiri.')}>
                        Akhiri cuti
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 border-b pb-3">
            <h2 className="font-heading text-xl">Pengajuan nonaktif</h2>
            <span className="text-xs text-muted-foreground">diverifikasi Koor SMP ke kesiswaan SMP</span>
            {bisaVerifikasi && (
              <Link href={`/asrama/pengajuan?g=${gender}`} className="ml-auto text-xs font-bold text-primary hover:underline">Buka verifikasi →</Link>
            )}
          </div>
          {pengajuan.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground">Belum ada pengajuan dalam 60 hari terakhir.</p>
          ) : (
            <ul>
              {pengajuan.slice(0, 8).map(p => (
                <li key={p.id} className="flex items-center gap-3 border-b py-3 last:border-0">
                  <p className="w-36 shrink-0 text-sm font-bold">{p.nama}{p.kelas && <span className="font-normal text-muted-foreground"> · {p.kelas}</span>}</p>
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {LABEL_ALASAN[p.alasan]} · {p.status === 'menunggu'
                      ? `efektif ${tglPendek(p.tanggal_efektif)} · diajukan ${tglPendek(p.diajukan_at)}`
                      : p.status === 'disetujui'
                        ? `disetujui ${p.diputuskan_oleh ?? ''}, ${tglPendek(p.diputuskan_at)}${p.diterapkan_at ? '' : ` · berlaku ${tglPendek(p.tanggal_efektif)}`}`
                        : `ditolak${p.catatan_verifikasi ? `: “${p.catatan_verifikasi}”` : ''}`}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <LencanaStatus status={p.status} />
                    {bisaUbah && p.status === 'menunggu' && (
                      <button type="button" disabled={pending} onClick={() => jalankan(() => batalkanPengajuanAction(p.id), 'Pengajuan dibatalkan.')}
                        className="text-xs font-bold text-destructive hover:underline">Batalkan</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialog && (
        <DialogAsrama
          keadaan={dialog}
          tutup={() => setDialog(null)}
          gender={gender}
          kelompok={kelompok}
          calon={calon}
          guru={guru}
        />
      )}
    </div>
  )
}

function Ubin({ label, angka, ket, warna }: { label: string; angka: number | string; ket: string; warna?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-heading text-3xl leading-tight', warna)}>{angka}</p>
      <p className="text-xs text-muted-foreground">{ket}</p>
    </div>
  )
}
