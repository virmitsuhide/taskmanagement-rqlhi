'use client'

import { useMemo, useState } from 'react'
import { ArrowDownNarrowWide, ArrowUpNarrowWide, BookOpen, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmen } from './Segmen'
import {
  formatJadwalSingkat,
  formatTanggalSingkat,
  formatTahsinLevels,
  getTahfidzLabel,
} from '@/lib/rq/ujian'
import type { UjianTahfidz, UjianTahsin, UjianUnit } from '@/types'

interface Props {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
}

type ArahUrut = 'asc' | 'desc'

/**
 * Nomor antrian menurut urutan pengajuan — yang paling lama menunggu bernomor 1.
 *
 * Dihitung terpisah dari urutan tampilan supaya nomor seorang anak tidak
 * berubah saat pengunjung membalik urutannya. Nomor antrian itu janji tempat,
 * bukan nomor baris.
 */
function nomorAntrian<T extends { id: string; created_at: string }>(items: T[]) {
  const urut = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  return new Map(urut.map((it, i) => [it.id, i + 1]))
}

function urutkan<T extends { created_at: string }>(items: T[], arah: ArahUrut) {
  return [...items].sort((a, b) => {
    const selisih = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return arah === 'asc' ? selisih : -selisih
  })
}

export function AntrianUjian({ tahfidz, tahsin }: Props) {
  const [unit, setUnit] = useState<UjianUnit>('SD')
  const [arah, setArah] = useState<ArahUrut>('asc')

  const tfUnit = useMemo(() => tahfidz.filter(t => t.unit === unit), [tahfidz, unit])
  const tsUnit = useMemo(() => tahsin.filter(t => t.unit === unit), [tahsin, unit])

  const tfNomor = useMemo(() => nomorAntrian(tfUnit), [tfUnit])
  const tsNomor = useMemo(() => nomorAntrian(tsUnit), [tsUnit])

  const tfUrut = useMemo(() => urutkan(tfUnit, arah), [tfUnit, arah])
  const tsUrut = useMemo(() => urutkan(tsUnit, arah), [tsUnit, arah])

  const total = tfUnit.length + tsUnit.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmen
          label="Pilih unit"
          value={unit}
          onChange={setUnit}
          className="w-full sm:w-64"
          options={[
            { value: 'SD',  label: 'SDIT LHI'  },
            { value: 'SMP', label: 'SMPIT LHI' },
          ]}
        />

        {total > 0 && (
          <Button
            variant="outline" size="sm"
            onClick={() => setArah(a => (a === 'asc' ? 'desc' : 'asc'))}
          >
            {arah === 'asc'
              ? <ArrowUpNarrowWide className="mr-1.5 h-3.5 w-3.5" />
              : <ArrowDownNarrowWide className="mr-1.5 h-3.5 w-3.5" />}
            {arah === 'asc' ? 'Terlama dahulu' : 'Terbaru dahulu'}
          </Button>
        )}
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">Belum ada antrian untuk unit {unit}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pengajuan yang masuk akan tampil di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Seksi
            judul="Antrian Tahfidz"
            jumlah={tfUnit.length}
            icon={<BookOpen className="h-4 w-4 text-info" />}
            kosong="Belum ada pengajuan tahfidz"
          >
            {tfUrut.map(item => (
              <KartuAntrian
                key={item.id}
                nomor={tfNomor.get(item.id)}
                judul={item.nama_siswa}
                quls={item.is_quls}
                rincian={`Kelas ${item.kelas} · ${getTahfidzLabel(item.tipe, item.juz)}`}
                jadwal={item.jadwal}
                penguji={item.penguji}
                diajukan={item.created_at}
              />
            ))}
          </Seksi>

          <Seksi
            judul="Antrian Tahsin"
            jumlah={tsUnit.length}
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
            kosong="Belum ada pengajuan tahsin"
          >
            {tsUrut.map(item => (
              <KartuAntrian
                key={item.id}
                nomor={tsNomor.get(item.id)}
                judul={item.nama_kelompok}
                rincian={`${formatTahsinLevels(item)} · ${item.siswa.length} siswa · Sesi ${item.sesi}`}
                jadwal={item.jadwal}
                penguji={item.penguji}
                diajukan={item.created_at}
              />
            ))}
          </Seksi>
        </div>
      )}
    </div>
  )
}

function Seksi({
  judul, jumlah, icon, kosong, children,
}: {
  judul: string
  jumlah: number
  icon: React.ReactNode
  kosong: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {judul}
        <span className="font-normal text-muted-foreground">({jumlah})</span>
      </h2>
      {jumlah === 0 ? (
        <p className="rounded-xl border border-dashed py-5 text-center text-sm text-muted-foreground">
          {kosong}
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}

function KartuAntrian({
  nomor, judul, rincian, jadwal, penguji, diajukan, quls,
}: {
  nomor?: number
  judul: string
  rincian: string
  jadwal: string | null
  penguji: string | null
  diajukan: string
  quls?: boolean
}) {
  return (
    <li className="rounded-xl border bg-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-xs font-semibold text-muted-foreground">
            #{nomor}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {judul}
              {quls && (
                <Badge variant="info" className="ml-1.5 align-middle">QULS</Badge>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{rincian}</p>
          </div>
        </div>
        <Badge variant={jadwal ? 'info' : 'warning'} className="shrink-0">
          {formatJadwalSingkat(jadwal)}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
        <span>Diajukan {formatTanggalSingkat(diajukan)}</span>
        <span className={penguji ? 'text-foreground' : undefined}>
          {penguji || 'Penguji belum ditentukan'}
        </span>
      </div>
    </li>
  )
}
