'use client'

import { useMemo, useState } from 'react'
import {
  CircleAlert, CircleCheck, CircleDashed, CircleX, Repeat, Users, UserX,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { CADENCES, CADENCE_LABELS, labelPeriode } from '@/lib/rutin/periode'
import { badgeKelas, labelStatus } from '@/lib/rutin/status'
import type { RoutineBoard, RoutineBoardOwner } from '@/lib/data/rutin'
import type { RoutineCadence, RoutineTaskState } from '@/types'

/**
 * Papan tugas rutin seluruh pengurus — tampilan kepala RQ.
 *
 * KENAPA KENDALA DITARIK KE ATAS, TERPISAH DARI DAFTARNYA
 *
 * Kepala RQ membuka papan ini untuk satu pertanyaan: apa yang tidak jalan,
 * dan kenapa. Kalau laporan "tidak terlaksana" hanya diselipkan sebagai baris
 * merah di antara puluhan baris hijau milik tiga belas pengurus, menjawab
 * pertanyaan itu berarti menyisir seluruh halaman — tiap pekan, selamanya.
 * Ringkasan di atas membuat jawabannya terbaca tanpa menggulir, sementara
 * daftar per pengurus di bawah tetap ada untuk melihat konteksnya.
 *
 * KENAPA PENYARINGANNYA DI KLIEN
 *
 * Seluruh papan muat dalam satu muatan — tiga belas pengurus dikali beberapa
 * tugas — jadi berpindah antar irama tidak perlu menyentuh server sama
 * sekali. Menjadikannya parameter URL akan menambah satu perjalanan jaringan
 * pada gerakan yang paling sering dilakukan di halaman ini.
 */

type Saringan = RoutineCadence | 'semua'

export function PapanRutin({ board }: { board: RoutineBoard }) {
  const [saringan, setSaringan] = useState<Saringan>('semua')

  const cocok = (c: RoutineCadence) => saringan === 'semua' || saringan === c

  const owners = useMemo(
    () =>
      board.owners.map(o => ({
        ...o,
        items: o.items.filter(i => cocok(i.task.cadence)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.owners, saringan],
  )

  const tampil = owners.flatMap(o => o.items)
  const kendala = board.kendala.filter(k => cocok(k.task.cadence))
  const done = tampil.filter(i => i.outcome === 'terlaksana').length
  const pending = tampil.filter(i => i.outcome === null).length

  // Pengurus yang sama sekali belum menyusun tugas rutin — dihitung dari
  // daftar utuh, bukan dari hasil saringan: "belum punya tugas pekanan"
  // berbeda artinya dengan "belum punya tugas rutin sama sekali".
  const tanpaTugas = board.owners.filter(o => o.total === 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat icon={<Repeat className="h-4 w-4" />} label="Tugas rutin" value={tampil.length} />
        <Stat
          icon={<CircleCheck className="h-4 w-4 text-success" />}
          label="Terlaksana"
          value={done}
        />
        <Stat
          icon={<CircleX className="h-4 w-4 text-destructive" />}
          label="Tidak terlaksana"
          value={kendala.length}
          nyala={kendala.length > 0}
        />
        <Stat
          icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />}
          label="Belum dilaporkan"
          value={pending}
        />
      </div>

      <Saringannya nilai={saringan} onPilih={setSaringan} board={board} />

      {kendala.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive-wash px-5 py-3">
            <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">
              Tidak terlaksana periode ini
            </h2>
            <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-destructive">
              {kendala.length}
            </span>
          </div>
          <ul className="divide-y">
            {kendala.map(k => (
              <li key={`${k.ownerId}-${k.task.id}`} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{k.displayName}</span>
                  <span className="rounded-full border bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                    {ROLE_LABELS[k.role]}
                  </span>
                  <span className="rounded-full border bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                    {CADENCE_LABELS[k.task.cadence]}
                  </span>
                  {k.reportedAt && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {tanggalSingkat(k.reportedAt)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-snug">{k.task.description}</p>
                {/*
                  Alasannya diberi garis tepi kiri, bukan sekadar teks abu-abu:
                  inilah satu-satunya kalimat di papan ini yang ditulis manusia,
                  dan ia perlu terbaca sebagai kutipan — bukan sebagai metadata.
                */}
                <p className="mt-1.5 border-l-2 border-destructive/40 pl-2.5 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {k.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tanpaTugas.length > 0 && (
        <section className="rounded-xl border border-dashed bg-card p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserX className="h-4 w-4 text-warning" />
            Belum menyusun tugas rutin
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Amanah berikut belum punya satu pun pekerjaan berulang yang tercatat.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tanpaTugas.map(o => (
              <span
                key={o.userId}
                className="rounded-full border bg-muted px-2 py-1 text-[11px]"
              >
                {o.displayName}
                <span className="text-muted-foreground"> · {ROLE_LABELS[o.role]}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {owners
          .filter(o => o.total > 0)
          .map(o => (
            <KartuPengurus key={o.userId} owner={o} saringan={saringan} />
          ))}
      </div>

      {board.total === 0 && (
        <p className="rounded-xl border border-dashed bg-card px-5 py-10 text-center text-sm italic text-muted-foreground">
          Belum ada satu pun tugas rutin yang disusun pengurus.
        </p>
      )}
    </div>
  )
}

/** Tab irama, lengkap dengan periode yang sedang berjalan untuk tiap irama. */
function Saringannya({
  nilai, onPilih, board,
}: {
  nilai: Saringan
  onPilih: (v: Saringan) => void
  board: RoutineBoard
}) {
  const jumlah = (c: RoutineCadence) =>
    board.owners.reduce((n, o) => n + o.items.filter(i => i.task.cadence === c).length, 0)

  const opsi: { key: Saringan; label: string; n: number }[] = [
    { key: 'semua', label: 'Semua', n: board.total },
    ...CADENCES.map(c => ({ key: c as Saringan, label: CADENCE_LABELS[c], n: jumlah(c) })),
  ]

  return (
    <div className="rounded-xl border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {opsi.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onPilih(o.key)}
            aria-pressed={nilai === o.key}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              nilai === o.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {o.label}
            <span
              className={`tabular-nums ${
                nilai === o.key ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
              }`}
            >
              {o.n}
            </span>
          </button>
        ))}
      </div>
      {nilai !== 'semua' && (
        <p className="px-3 pt-1.5 pb-0.5 text-[11px] text-muted-foreground">
          Periode berjalan: {labelPeriode(nilai)}
        </p>
      )}
    </div>
  )
}

function KartuPengurus({
  owner, saringan,
}: {
  owner: RoutineBoardOwner
  saringan: Saringan
}) {
  const done = owner.items.filter(i => i.outcome === 'terlaksana').length
  const missed = owner.items.filter(i => i.outcome === 'tidak_terlaksana').length

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <Avatar size="lg">
          {owner.photoUrl && <AvatarImage src={owner.photoUrl} alt="" />}
          <AvatarFallback className="text-xs font-semibold">
            {inisial(owner.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{owner.displayName}</p>
          <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[owner.role]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {missed > 0 && (
            <span className="rounded-full bg-destructive-wash px-2 py-0.5 text-[11px] font-medium tabular-nums text-destructive">
              {missed} gagal
            </span>
          )}
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {done}/{owner.items.length}
          </span>
        </div>
      </div>

      {owner.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">
          Tidak ada tugas {saringan === 'semua' ? 'rutin' : CADENCE_LABELS[saringan].toLowerCase()}.
        </p>
      ) : (
        <ul className="divide-y">
          {owner.items.map(item => (
            <BarisTugas key={item.task.id} item={item} tampilkanIrama={saringan === 'semua'} />
          ))}
        </ul>
      )}
    </section>
  )
}

function BarisTugas({
  item, tampilkanIrama,
}: {
  item: RoutineTaskState
  tampilkanIrama: boolean
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-snug ${
              item.outcome === 'terlaksana' ? 'text-muted-foreground' : ''
            }`}
          >
            {item.task.description}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {tampilkanIrama && (
              <span className="rounded-full border bg-muted px-1.5 py-px text-[10px]">
                {CADENCE_LABELS[item.task.cadence]}
              </span>
            )}
            {item.checkedAt && <span>Dilaporkan {tanggalSingkat(item.checkedAt)}</span>}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeKelas(item.outcome)}`}
        >
          {labelStatus(item.outcome)}
        </span>
      </div>

      {item.outcome === 'tidak_terlaksana' && item.reason && (
        <p className="mt-1.5 border-l-2 border-destructive/40 pl-2.5 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {item.reason}
        </p>
      )}
    </li>
  )
}

function Stat({
  icon, label, value, nyala,
}: {
  icon: React.ReactNode
  label: string
  value: number
  nyala?: boolean
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-3 ${
        nyala ? 'border-destructive/30 bg-destructive-wash/40' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</p>
    </div>
  )
}

/** Lencana jumlah pengurus di header halaman. */
export function JumlahPengurus({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
      <Users className="h-3.5 w-3.5" />
      {n} pengurus
    </span>
  )
}

function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map(k => k[0] ?? '')
    .join('')
    .toUpperCase()
}

/** "Sen, 8 Sep 14.20" — papan ini dibaca berhari-hari setelah laporannya masuk. */
function tanggalSingkat(iso: string): string {
  const d = new Date(iso)
  const tanggal = d.toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${tanggal} ${jam}`
}
