import Link from 'next/link'
import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JenisNotifUjian, NotifUjian } from '@/lib/data/ujian-notifikasi'

const META: Record<JenisNotifUjian, { label: string; tone: string; icon: React.ReactNode }> = {
  diajukan:    { label: 'Pengajuan ujian baru', tone: 'text-primary', icon: <Send className="h-3.5 w-3.5" /> },
  dijadwalkan: { label: 'Ujian dijadwalkan',    tone: 'text-info',    icon: <CalendarClock className="h-3.5 w-3.5" /> },
  selesai:     { label: 'Ujian selesai',        tone: 'text-success', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
}

function sejakKapan(iso: string): string {
  const menit = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari === 1) return 'kemarin'
  if (hari < 7) return `${hari} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/**
 * Satu baris notifikasi ujian di laci lonceng — dipakai lonceng guru dan
 * lonceng pengurus, supaya kabar yang sama berbunyi sama di kedua sisi.
 */
export function BarisNotifUjian({ item, href, onPilih }: {
  item: NotifUjian
  href: string
  onPilih?: () => void
}) {
  const meta = META[item.jenis]
  return (
    <Link
      href={href}
      onClick={onPilih}
      className={cn(
        'flex gap-2.5 px-3 py-2.5 transition-colors',
        item.dibaca ? 'hover:bg-accent' : 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      <span
        aria-hidden
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.dibaca ? 'bg-transparent' : 'bg-primary')}
      />
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-1 text-xs font-medium', meta.tone)}>
          {meta.icon}
          {meta.label}
          <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground font-normal">
            {item.ujian === 'tahfidz'
              ? <><BookOpen className="h-3 w-3" /> Tahfidz</>
              : <><ClipboardList className="h-3 w-3" /> Tahsin</>}
          </span>
        </span>
        <span className={cn('mt-0.5 block truncate text-sm', item.dibaca ? 'text-muted-foreground' : 'font-medium')}>
          {item.judul}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {item.rincian} · {sejakKapan(item.waktu)}
        </span>
      </span>
      {!item.dibaca && <span className="sr-only">Belum dilihat</span>}
    </Link>
  )
}
