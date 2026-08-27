'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightLeft, Check, Users } from 'lucide-react'
import { pindahSiswaAction } from '@/app/actions/pindah-halaqoh'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { sesiLabel } from '@/lib/rq/sesi'
import { cn } from '@/lib/utils'

export interface SiswaBaris {
  id: string
  full_name: string
  nis: string | null
  kelas: string | null
  gender: 'L' | 'P' | null
}

export interface HalaqohTujuanOpsi {
  id: string
  name: string
  sesi: number | null
  wali: string | null
  jumlah: number
}

interface Props {
  siswa: SiswaBaris[]
  /** Halaqoh lain sejenjang yang boleh diisi pengurus ini — tanpa yang sekarang. */
  tujuan: HalaqohTujuanOpsi[]
  /** Sesi halaqoh yang sedang dibuka — dipakai menandai tujuan yang sesesi. */
  sesiSekarang: number | null
  canManage: boolean
}

/**
 * Daftar santri sebuah halaqoh, sekaligus tempat memindahkannya.
 *
 * Pemindahan ditaruh DI SINI, bukan di formulir tiap santri, karena begitulah
 * kejadiannya: koordinator membuka satu kelompok, melihat siapa saja isinya,
 * lalu memindahkan beberapa anak sekaligus. Lewat formulir santri, memindahkan
 * lima anak berarti membuka lima halaman dan mengingat halaqoh tujuannya
 * lima kali.
 *
 * Mode pilih sengaja tidak menyala terus-menerus. Halaman ini paling sering
 * dibuka untuk MEMBACA daftar; kotak centang yang selalu ada membuat setiap
 * kunjungan terasa seperti hendak mengubah sesuatu.
 */
export function PindahSiswa({ siswa, tujuan, sesiSekarang, canManage }: Props) {
  const router = useRouter()
  const [memilih, setMemilih] = useState(false)
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const [dialogTerbuka, setDialogTerbuka] = useState(false)
  const [tujuanId, setTujuanId] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const semuaTerpilih = siswa.length > 0 && dipilih.size === siswa.length

  function toggle(id: string) {
    setDipilih(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function keluarModePilih() {
    setMemilih(false)
    setDipilih(new Set())
  }

  function simpan() {
    const ids = [...dipilih]
    const halaqoh = tujuan.find(t => t.id === tujuanId)
    if (ids.length === 0 || !halaqoh) return

    startTransition(async () => {
      const hasil = await pindahSiswaAction(ids, tujuanId)
      if (hasil.error) {
        toast.error(hasil.error)
        return
      }
      const dilewati = hasil.dilewati.length
      toast.success(
        `${hasil.dipindah} santri pindah ke ${halaqoh.name}.`,
        dilewati > 0
          ? { description: `${dilewati} dilewati: ${hasil.dilewati.map(d => `${d.nama} (${d.alasan})`).join(', ')}` }
          : undefined,
      )
      setDialogTerbuka(false)
      keluarModePilih()
      router.refresh()
    })
  }

  // Tujuan sesesi didahulukan: memindahkan anak ke sesi lain berarti mengubah
  // jam belajarnya, dan itu perkecualian — bukan hal yang dicari lebih dulu.
  const tujuanTerurut = useMemo(() => {
    return [...tujuan].sort((a, b) => {
      const aSama = a.sesi === sesiSekarang ? 0 : 1
      const bSama = b.sesi === sesiSekarang ? 0 : 1
      if (aSama !== bSama) return aSama - bSama
      if ((a.sesi ?? 9) !== (b.sesi ?? 9)) return (a.sesi ?? 9) - (b.sesi ?? 9)
      return a.name.localeCompare(b.name)
    })
  }, [tujuan, sesiSekarang])

  if (siswa.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        Belum ada siswa di halaqoh ini.
      </div>
    )
  }

  return (
    <>
      {canManage && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {memilih ? (
            <>
              <button
                type="button"
                onClick={() => setDipilih(semuaTerpilih ? new Set() : new Set(siswa.map(s => s.id)))}
                className="text-xs font-medium text-primary hover:underline"
              >
                {semuaTerpilih ? 'Kosongkan pilihan' : `Pilih semua (${siswa.length})`}
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <button
                type="button"
                onClick={keluarModePilih}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setMemilih(true)} disabled={tujuan.length === 0}>
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />Pindahkan Santri
            </Button>
          )}
          {!memilih && tujuan.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Belum ada halaqoh lain yang bisa dijadikan tujuan.
            </span>
          )}
        </div>
      )}

      <div className="rounded-lg border divide-y bg-card">
        {siswa.map(s => {
          const terpilih = dipilih.has(s.id)
          const isi = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{s.full_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.kelas ? `Kelas ${s.kelas}` : '—'} {s.nis && `· NIS ${s.nis}`}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {s.gender === 'L' ? '👦' : s.gender === 'P' ? '👧' : ''}
              </span>
            </>
          )

          // Dalam mode pilih, seluruh baris jadi tombol centang — bukan hanya
          // kotak kecilnya. Daftar ini sering dipakai di ponsel.
          return memilih ? (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={terpilih}
              className={cn(
                'flex w-full items-center gap-3 p-3 text-left transition-colors',
                terpilih ? 'bg-primary-wash' : 'hover:bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border',
                  terpilih ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}
                aria-hidden
              >
                {terpilih && <Check className="h-3 w-3" />}
              </span>
              <span className="flex flex-1 items-center justify-between gap-3 min-w-0">{isi}</span>
            </button>
          ) : (
            <Link
              key={s.id}
              href={`/siswa/${s.id}`}
              className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/30"
            >
              {isi}
            </Link>
          )
        })}
      </div>

      {/* Bilah aksi menempel di bawah layar: daftar 30 anak lebih panjang dari
          satu layar, dan tombolnya harus terjangkau di mana pun gulirannya. */}
      {memilih && dipilih.size > 0 && (
        <div className="sticky bottom-4 z-20 mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">
            {dipilih.size} santri dipilih
          </span>
          <div className="flex-1" />
          <Button size="sm" onClick={() => { setTujuanId(''); setDialogTerbuka(true) }}>
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />Pindahkan…
          </Button>
        </div>
      )}

      <Dialog open={dialogTerbuka} onOpenChange={o => !isPending && setDialogTerbuka(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pindahkan {dipilih.size} santri</DialogTitle>
            <DialogDescription>
              Penempatan lamanya ditutup sebagai riwayat, bukan dihapus — rapor bulan
              lalu tetap menyebut ustadz yang benar.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-1 overflow-auto">
            {tujuanTerurut.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTujuanId(t.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                  tujuanId === t.id
                    ? 'border-primary bg-primary-wash'
                    : 'border-transparent hover:bg-muted/40',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {t.wali ?? t.name}
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    {sesiLabel(t.sesi)}
                    {t.sesi !== sesiSekarang && (
                      <span className="ml-1.5 text-warning">· beda sesi</span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Users className="h-3.5 w-3.5" />{t.jumlah}
                </span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTerbuka(false)} disabled={isPending}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={isPending || !tujuanId}>
              {isPending ? 'Memindahkan…' : 'Pindahkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
