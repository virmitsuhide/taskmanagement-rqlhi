'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Target, ArrowDown, Check, ArrowUp, Sparkles, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HafalanBoard } from '@/lib/data/analytics'

interface Props {
  boards: HafalanBoard[]
}

const RANK_COLOR = ['#f59e0b', '#94a3b8', '#b45309'] // emas, perak, perunggu

export function UnitHafalanBoard({ boards }: Props) {
  const [active, setActive] = useState(() => (boards.find(b => b.studentCount > 0) ?? boards[0])?.jenjang)
  const board = boards.find(b => b.jenjang === active) ?? boards[0]

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4" /> Hafalan per Unit
      </h2>

      {/* Tab unit */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {boards.map(b => {
          const isActive = b.jenjang === active
          return (
            <button
              key={b.jenjang}
              type="button"
              onClick={() => setActive(b.jenjang)}
              aria-pressed={isActive}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border',
              )}
            >
              {b.label} <span className="opacity-70">· {b.studentCount}</span>
            </button>
          )
        })}
      </div>

      {board && <BoardPanel board={board} />}
    </section>
  )
}

function BoardPanel({ board }: { board: HafalanBoard }) {
  return (
    <div className="space-y-5">
      {/* Posisi vs target */}
      <div>
        <h3 className="text-xs font-semibold mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Posisi Siswa vs Target Bulan Ini</span>
          <Link href="/dashboard/analitik/target-tahfidz" className="font-normal text-primary hover:underline">Rincian →</Link>
        </h3>
        {!board.target.berlaku ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">
            {board.studentCount === 0
              ? `Belum ada siswa aktif di ${board.label}.`
              : `${board.label} belum punya rencana target tahfidz.`}
          </p>
        ) : (
          <>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <tbody>
                <TargetRow icon={<ArrowDown className="h-3.5 w-3.5" />} label="Di bawah target" value={board.target.below} color="var(--destructive)" />
                <TargetRow icon={<Check className="h-3.5 w-3.5" />} label="Sesuai target" value={board.target.on} color="var(--success)" />
                <TargetRow icon={<ArrowUp className="h-3.5 w-3.5" />} label="Di atas target" value={board.target.above} color="var(--info)" />
                <TargetRow icon={<HelpCircle className="h-3.5 w-3.5" />} label="Belum terukur" value={board.target.belumTerukur} color="var(--muted-foreground)" />
              </tbody>
            </table>
            {/* "Belum terukur" bukan "di bawah": capaian sebagian besar siswa masih
                berupa teks bebas di rangkuman bulanan, yang tidak dibaca mesin. */}
            {board.target.tanpaTarget > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">{board.target.tanpaTarget} siswa tanpa target (mis. QuLS Takhassus).</p>
            )}
          </>
        )}
      </div>

      {/* 10 besar hafalan */}
      <div>
        <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> 10 Besar Hafalan
        </h3>
        {board.top10.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Belum ada data hafalan di unit ini.</p>
        ) : (
          <ol className="space-y-1.5">
            {board.top10.map((s, i) => (
              <li key={s.id}>
                <Link href={`/siswa/${s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
                    style={{ background: RANK_COLOR[i] ?? 'var(--muted)', color: i < 3 ? '#fff' : 'var(--muted-foreground)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.kelas ? `Kelas ${s.kelas}` : 'Tanpa kelas'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{s.juzCount} juz</p>
                    <p className="text-[11px] text-muted-foreground">{s.totalAyat.toLocaleString('id-ID')} ayat</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function TargetRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2" style={{ color }}>{icon}<span className="text-foreground">{label}</span></span>
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{value} siswa</td>
    </tr>
  )
}
