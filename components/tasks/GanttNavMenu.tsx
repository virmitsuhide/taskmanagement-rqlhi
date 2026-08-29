'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { GanttChartSquare, ChevronDown, User, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GanttPerson } from '@/lib/data/gantt'

/**
 * Petunjuk navigasi ke Gantt Chart — dipasang di papan kanban & daftar tugas.
 *
 * Daftar orangnya datang dari getGanttPeople(), yang cakupannya dipinjam dari
 * izin papan kanban (getBoardDivisions). Menu ini menyatakan hal itu terang-
 * terangan di bagian bawahnya: papan divisi dan Gantt memperlihatkan kumpulan
 * tugas yang sama, jadi tidak ada kejutan soal "kenapa saya bisa/tidak bisa
 * melihat orang ini".
 *
 * YANG TAMPIL ADALAH JABATAN, BUKAN NAMA ORANG
 *
 * Amanah berpindah tangan; "Koor SD" tetap berarti hal yang sama tahun depan,
 * sementara Gantt atas nama seseorang jadi menyesatkan begitu jabatannya
 * beralih. GanttPerson memang sudah tidak membawa display_name (lihat
 * lib/data/gantt.ts), jadi komponen ini tidak punya nama untuk ditampilkan
 * sekalipun ada tampilan baru yang menghendakinya.
 */

interface Props {
  people: GanttPerson[]
  /** Jabatan pemirsa sendiri. */
  selfLabel: string
  /** Orang yang sedang dibuka Gantt-nya, kalau menu ini dipasang di halaman Gantt. */
  activeUserId?: string
  /** Skala yang sedang dipakai, agar berpindah orang tidak mengubah zoom. */
  scale?: string
}

export function GanttNavMenu({ people, selfLabel, activeUserId, scale }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onClick)
      document.addEventListener('keydown', onEsc)
    }
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function href(userId?: string): string {
    const p = new URLSearchParams()
    if (userId) p.set('user', userId)
    if (scale && scale !== 'hari') p.set('scale', scale)
    const qs = p.toString()
    return qs ? `/tasks/gantt?${qs}` : '/tasks/gantt'
  }

  // Tanpa bawahan, menu dropdown cuma berisi satu baris — tautan polos lebih jujur.
  if (people.length === 0) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={href()}>
          <GanttChartSquare className="mr-1 h-4 w-4" />Gantt Chart
        </Link>
      </Button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" variant="outline" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <GanttChartSquare className="mr-1 h-4 w-4" />Gantt Chart
        <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
      </Button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 max-h-[70vh] w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg">
          <Link
            href={href()}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-accent"
          >
            <User className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Gantt Chart Saya</div>
              <div className="truncate text-[11px] text-muted-foreground">{selfLabel}</div>
            </div>
            {!activeUserId && <Check className="h-3.5 w-3.5 text-primary" />}
          </Link>

          {/* Daftar rata, tanpa pengelompokan per divisi: sejak label yang tampil
              adalah jabatan itu sendiri, judul kelompok akan berbunyi persis sama
              dengan barisnya. */}
          <div className="mt-1 border-t pt-1">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Jabatan di bawah pantauan Anda
            </p>
            {people.map(p => (
              <Link
                key={p.id}
                href={href(p.id)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors hover:bg-accent"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {initials(p.label)}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {p.activeTasks}
                </span>
                {activeUserId === p.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </Link>
            ))}
          </div>

          <p className="flex items-start gap-1.5 border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            Daftar ini mengikuti izin papan kanban Anda — sama persis dengan divisi
            yang muncul di tab &ldquo;Divisi&rdquo;.
          </p>
        </div>
      )}
    </div>
  )
}

/** "Koor SD" → "KS". Untuk lencana bulat kecil, bukan sebagai identitas orang. */
function initials(label: string) {
  return label.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

/**
 * Deret pintasan ke Gantt Chart tiap jabatan — dipasang di papan divisi.
 *
 * Menu dropdown di pojok kanan bagus untuk berpindah cepat, tapi ia tidak
 * memberi tahu siapa pun bahwa fitur ini ada. Deret ini yang mengerjakan tugas
 * itu: begitu seseorang membuka papan divisinya, ia langsung melihat jabatan
 * mana saja yang Gantt-nya boleh ia buka, lengkap dengan jumlah tugas aktifnya.
 */
export function GanttPeopleStrip({
  people, selfLabel,
}: {
  people: GanttPerson[]
  selfLabel: string
}) {
  if (people.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <GanttChartSquare className="h-3.5 w-3.5" />
        Gantt Chart tim
        <span className="font-normal text-muted-foreground/70">
          — sesuai izin papan Anda
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/tasks/gantt"
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <User className="h-3 w-3" />
          Saya ({selfLabel})
        </Link>
        {people.map(p => (
          <Link
            key={p.id}
            href={`/tasks/gantt?user=${p.id}`}
            title={`Gantt Chart ${p.label}`}
            className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
              {initials(p.label)}
            </span>
            {p.label}
            {p.activeTasks > 0 && (
              <span className="tabular-nums text-[10px] text-muted-foreground/70">{p.activeTasks}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
