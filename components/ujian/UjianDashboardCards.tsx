import Link from 'next/link'
import { BookOpen, CalendarClock, ClipboardList, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getUjianBaruCount, getUjianStats } from '@/lib/data/ujian'
import { getUjianUnits } from '@/lib/auth/permissions'
import type { UjianStats, UserRole } from '@/types'

interface Props {
  role: UserRole
  userId: string
}

/**
 * Dua kartu ujian di dashboard kepala RQ, kumik, koor SD, dan koor SMP.
 *
 * Tidak menampilkan apa pun untuk role yang tidak memegang unit ujian, jadi
 * dashboard lain aman memanggilnya tanpa pemeriksaan tambahan — tapi
 * dashboard yang memang tidak relevan sebaiknya tidak memanggilnya sama
 * sekali, supaya tidak ada query yang sia-sia.
 */
export async function UjianDashboardCards({ role, userId }: Props) {
  const units = getUjianUnits(role)
  if (units.length === 0) return null

  const [tahfidz, tahsin, baru] = await Promise.all([
    getUjianStats('tahfidz', units),
    getUjianStats('tahsin', units),
    getUjianBaruCount(userId, units),
  ])

  const cakupan = units.length > 1 ? 'SD & SMP' : units[0]

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Ujian Tahsin &amp; Tahfidz
          <span className="font-normal text-muted-foreground">{cakupan}</span>
          {baru > 0 && (
            <Badge variant="destructive">{baru > 99 ? '99+' : baru} baru</Badge>
          )}
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link href="/ujian/ajukan"><Plus className="mr-1 h-3 w-3" />Ajukan</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <KartuUjian
          href="/ujian/kelola?jenis=tahsin"
          judul="Ujian Tahsin"
          keterangan="Kelompok jilid & Al-Qur'an"
          icon={<ClipboardList className="h-4 w-4 text-primary" />}
          stats={tahsin}
        />
        <KartuUjian
          href="/ujian/kelola?jenis=tahfidz"
          judul="Ujian Tahfidz"
          keterangan="Tasmi' 1, 3, dan 5 juz"
          icon={<BookOpen className="h-4 w-4 text-info" />}
          stats={tahfidz}
        />
      </div>
    </section>
  )
}

function KartuUjian({
  href, judul, keterangan, icon, stats,
}: {
  href: string
  judul: string
  keterangan: string
  icon: React.ReactNode
  stats: UjianStats
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-medium">{icon}{judul}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
        </div>
        {/* Angka yang paling menuntut tindakan ditaruh paling besar: pengajuan
            yang belum dijadwalkan adalah antrian yang menunggu koordinator. */}
        <div className="text-right">
          <p className="text-2xl font-semibold leading-none">{stats.diajukan}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">perlu dijadwalkan</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {stats.dijadwalkan} terjadwal
        </span>
        <span>·</span>
        <span>{stats.selesai} selesai</span>
      </div>
    </Link>
  )
}
