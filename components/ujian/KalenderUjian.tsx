'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BULAN_ID } from '@/lib/rq/ujian'
import type { EventUjian } from '@/lib/data/ujian'

interface Props {
  events: EventUjian[]
  year: number
  /** 0-indeks, sesuai Date. */
  month: number
  /** Hari ini menurut WIB (YYYY-MM-DD), dihitung di server. */
  todayWIB: string
}

// Pekan dimulai Senin — kalender akademik RQ, bukan kalender Minggu-pertama.
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function formatTanggalTerpilih(tanggal: string): string {
  return new Date(`${tanggal}T12:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * Kalender jadwal ujian sebulan.
 *
 * Hari ini dan penanggalan bulan datang dari server sebagai string WIB, bukan
 * dihitung dari `new Date()` di peramban: pengurus yang laptopnya masih
 * berzona WITA akan melihat "hari ini" bergeser sehari kalau tidak begitu.
 */
export function KalenderUjian({ events, year, month, todayWIB }: Props) {
  const perTanggal: Record<string, EventUjian[]> = {}
  for (const e of events) (perTanggal[e.date] ??= []).push(e)

  const terdekat = events.map(e => e.date).filter(d => d >= todayWIB).sort()[0] ?? null
  const [dipilih, setDipilih] = useState<string | null>(
    perTanggal[todayWIB] ? todayWIB : terdekat,
  )

  const jumlahHari = new Date(year, month + 1, 0).getDate()
  const geser = (new Date(year, month, 1).getDay() + 6) % 7 // Senin = 0
  const totalSel = Math.ceil((geser + jumlahHari) / 7) * 7

  const sel = Array.from({ length: totalSel }, (_, i) => {
    const d = i - geser + 1
    return d >= 1 && d <= jumlahHari ? d : null
  })

  const keTanggal = (hari: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(hari).padStart(2, '0')}`

  const acaraTerpilih = dipilih ? (perTanggal[dipilih] ?? []) : []

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            Jadwal ujian — {BULAN_ID[month]} {year}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {events.length === 0
              ? 'Belum ada ujian terjadwal bulan ini'
              : `${events.length} ujian terjadwal`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-info" /> Tahfidz
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Tahsin
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/40">
        {HARI.map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Garis kisi digambar dari wadahnya, bukan dari tiap sel, supaya sel
          kosong di awal & akhir bulan ikut bergaris — kalau tidak, kisinya
          bolong di pojok. Kolom ketujuh tidak diberi garis kanan agar tidak
          menumpuk dengan bingkai kartu. */}
      <div className="grid grid-cols-7 [&>*]:border-b [&>*]:border-r [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
        {sel.map((hari, i) => {
          if (!hari) return <div key={`kosong-${i}`} className="h-12 bg-muted/20" />

          const tanggal = keTanggal(hari)
          const acara = perTanggal[tanggal] ?? []
          const hariIni = tanggal === todayWIB
          const aktif = tanggal === dipilih
          const adaAcara = acara.length > 0
          const titik = acara.slice(0, 3)
          const sisa = acara.length - titik.length

          return (
            <button
              key={tanggal}
              onClick={() => adaAcara && setDipilih(aktif ? null : tanggal)}
              disabled={!adaAcara}
              aria-label={`${hari} ${BULAN_ID[month]}${adaAcara ? `, ${acara.length} ujian` : ''}`}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-[3px] transition-colors',
                adaAcara ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default',
                aktif && 'bg-primary/10',
              )}
            >
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                hariIni ? 'bg-primary font-semibold text-primary-foreground'
                  : aktif ? 'bg-primary/20 font-semibold text-primary'
                  : adaAcara ? 'font-medium'
                  // Diredupkan supaya tanggal berjadwal yang menonjol, tapi
                  // tetap harus terbaca — ini kalender, bukan sekadar grafik.
                  : 'text-muted-foreground',
              )}>
                {hari}
              </span>
              {adaAcara && (
                <span className="flex items-center gap-[2px]">
                  {titik.map((e, j) => (
                    <span key={j} className={cn(
                      'h-[5px] w-[5px] rounded-full',
                      e.jenis === 'tahfidz' ? 'bg-info' : 'bg-primary',
                    )} />
                  ))}
                  {sisa > 0 && (
                    <span className="ml-[1px] text-[8px] font-semibold leading-none text-muted-foreground">
                      +{sisa}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {dipilih && acaraTerpilih.length > 0 ? (
        <div className="border-t px-4 py-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {formatTanggalTerpilih(dipilih)}
          </p>
          <ul className="space-y-1.5">
            {acaraTerpilih.map((e, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
                <span className={cn(
                  'h-5 w-1 shrink-0 rounded-full',
                  e.jenis === 'tahfidz' ? 'bg-info' : 'bg-primary',
                )} />
                <span className="min-w-0 flex-1 truncate text-sm">{e.nama}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {e.unit} · {e.jenis === 'tahfidz' ? 'Tahfidz' : 'Tahsin'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : events.length > 0 ? (
        <p className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          Pilih tanggal bertitik untuk melihat jadwalnya.
        </p>
      ) : null}
    </div>
  )
}
