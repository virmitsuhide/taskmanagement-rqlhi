'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ClipboardList, Trash2 } from 'lucide-react'
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
import type { UjianTahfidz, UjianTahsin } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
}

type Sasaran =
  | { jenis: 'tahfidz'; id: string; nama: string }
  | { jenis: 'tahsin'; id: string; nama: string }

/**
 * Daftar pengajuan milik seorang guru.
 *
 * Guru tidak menjadwalkan dan tidak menilai — itu wewenang koordinator — jadi
 * di sini semuanya hanya bisa dibaca. Satu-satunya tindakan adalah menarik
 * kembali pengajuan yang belum dijadwalkan, untuk memperbaiki salah ketik
 * tanpa harus menitip pesan ke koordinator.
 */
export function PengajuanGuru({ tahfidz, tahsin }: Props) {
  const router = useRouter()
  const [sasaran, setSasaran] = useState<Sasaran | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

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

  if (tahfidz.length === 0 && tahsin.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-14 text-center">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">Anda belum pernah mengajukan ujian</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pengajuan yang Anda buat akan muncul di sini beserta jadwal dan hasilnya.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {tahfidz.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-info" /> Tahfidz
            <span className="font-normal text-muted-foreground">({tahfidz.length})</span>
          </h2>
          <ul className="space-y-2">
            {tahfidz.map(item => (
              <Kartu
                key={item.id}
                judul={item.nama_siswa}
                rincian={`Kelas ${item.kelas} · ${getTahfidzLabel(item.tipe, item.juz)}`}
                status={item.status}
                jadwal={item.jadwal}
                penguji={item.penguji}
                dibuat={item.created_at}
                hasil={item.predikat ? getPredikatLabel(item.predikat) : null}
                hasilKelas={getPredikatClass(item.predikat)}
                onTarik={item.status === 'diajukan'
                  ? () => setSasaran({ jenis: 'tahfidz', id: item.id, nama: item.nama_siswa })
                  : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {tahsin.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="h-4 w-4 text-primary" /> Tahsin
            <span className="font-normal text-muted-foreground">({tahsin.length})</span>
          </h2>
          <ul className="space-y-2">
            {tahsin.map(item => {
              const lulus = item.siswa.filter(s => s.predikat === 'lulus').length
              return (
                <Kartu
                  key={item.id}
                  judul={item.nama_kelompok}
                  rincian={`${formatTahsinLevels(item)} · ${item.siswa.length} siswa · Sesi ${item.sesi}`}
                  status={item.status}
                  jadwal={item.jadwal}
                  penguji={item.penguji}
                  dibuat={item.created_at}
                  hasil={item.status === 'selesai' ? `${lulus}/${item.siswa.length} lulus` : null}
                  hasilKelas="text-success font-medium"
                  onTarik={item.status === 'diajukan'
                    ? () => setSasaran({ jenis: 'tahsin', id: item.id, nama: item.nama_kelompok })
                    : undefined}
                />
              )
            })}
          </ul>
        </section>
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

function Kartu({
  judul, rincian, status, jadwal, penguji, dibuat, hasil, hasilKelas, onTarik,
}: {
  judul: string
  rincian: string
  status: UjianTahfidz['status']
  jadwal: string | null
  penguji: string | null
  dibuat: string
  hasil: string | null
  hasilKelas: string
  onTarik?: () => void
}) {
  return (
    <li className="rounded-xl border bg-card p-3.5">
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
          Diajukan {formatTanggalSingkat(dibuat)}
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
