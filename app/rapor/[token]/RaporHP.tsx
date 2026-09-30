import { BookOpen, ScrollText, MessageSquare } from 'lucide-react'
import type { RaporData } from '@/lib/data/rapor'
import { cn } from '@/lib/utils'

const JENJANG_LABELS: Record<string, string> = { paud: 'PAUD', sd: 'SD', sd_juara: 'SD Juara', smp: 'SMP', sma: 'SMA' }

/**
 * Tampilan HP rapor bulanan untuk wali — hanya di halaman publik /rapor/[token].
 *
 * RaporDocument (lembar A4) tetap dipakai di layar lebar, saat dicetak, dan
 * di layar guru. Isi & label keduanya sama; yang berbeda hanya susunannya.
 */
export function RaporHP({ data }: { data: RaporData }) {
  const { student, tahsin, tahfidz, period, attendance, teacherName } = data
  const nilai = (v: number | null) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('id-ID'))

  return (
    <div className="space-y-4" style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-warm">Rapor Tahsin &amp; Tahfidz</p>
        <p className="text-xs text-muted-foreground">Rumah Qur&apos;an LHI · {period.monthLabel}</p>
        <h1 className="mt-1 font-heading text-3xl leading-tight">{student.full_name}</h1>
      </header>

      <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-2xl border bg-card p-4 text-sm">
        <dt className="text-muted-foreground">NIS</dt><dd className="font-bold">{student.nis ?? '—'}</dd>
        <dt className="text-muted-foreground">Jenjang/Kelas</dt>
        <dd className="font-bold">{JENJANG_LABELS[student.jenjang] ?? student.jenjang}{student.kelas ? ` · ${student.kelas}` : ''}</dd>
        <dt className="text-muted-foreground">Halaqoh</dt><dd className="font-bold">{student.halaqoh_name ?? '—'}</dd>
        <dt className="text-muted-foreground">Guru</dt><dd className="font-bold">{teacherName ?? '—'}</dd>
        <dt className="text-muted-foreground">Kehadiran</dt><dd className="font-bold">{attendance.activeDays} hari aktif setor</dd>
      </dl>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-primary-wash px-4 py-3">
          <p className="text-xs font-bold text-primary">Nilai tahsin</p>
          <p className="font-heading text-3xl leading-tight text-primary tabular-nums">{nilai(tahsin.avgTahsin)}</p>
        </div>
        <div className="rounded-2xl bg-accent-warm-wash px-4 py-3">
          <p className="text-xs font-bold text-accent-warm">Nilai tahfidz</p>
          <p className="font-heading text-3xl leading-tight text-accent-warm tabular-nums">{nilai(tahfidz.avgTahfidz)}</p>
        </div>
      </div>

      <Kartu judul="Capaian Tahsin" ikon={<BookOpen className="h-4 w-4" />} nada="primary">
        <Baris k="Posisi saat ini" v={tahsin.currentMethod && tahsin.currentJilid ? `${tahsin.currentMethod} ${tahsin.currentJilid} · hal. ${tahsin.currentPage ?? '—'}` : 'Belum ada data'} />
        <Baris k="Setoran bulan ini" v={`${tahsin.setoranCount}× (${tahsin.lulusCount} lulus)`} />
        <Baris k="Nilai tahsin" v={nilai(tahsin.avgTahsin)} />
        <Baris k="Nilai sikap" v={nilai(tahsin.avgSikap)} />
        {tahsin.promotions.length > 0 && (
          <Baris k="Kenaikan jilid" v={tahsin.promotions.map(p => `${p.from ?? '?'} → ${p.to}`).join(', ')} sukses />
        )}
      </Kartu>

      <Kartu judul="Capaian Tahfidz" ikon={<ScrollText className="h-4 w-4" />} nada="warm">
        <Baris k="Hafalan saat ini" v={tahfidz.currentJuz ? `Juz ${tahfidz.currentJuz} (${tahfidz.currentJuzPercent}%)` : 'Belum ada hafalan'} />
        <Baris k="Hafalan baru bulan ini" v={`${tahfidz.ayatBaru} ayat`} />
        <Baris k="Total ayat dihafal" v={`${tahfidz.totalAyatHafal} ayat`} />
        <Baris k="Muroja'ah bulan ini" v={`${tahfidz.murojaahCount}×`} />
        <Baris k="Nilai tahfidz" v={nilai(tahfidz.avgTahfidz)} />
        <Baris k="Nilai sikap" v={nilai(tahfidz.avgSikap)} />
        {tahfidz.juzTerujiCount > 0 && <Baris k="Juz teruji" v={`${tahfidz.juzTerujiCount} juz`} sukses />}
        {tahfidz.promotions.length > 0 && (
          <Baris k="Juz selesai bulan ini" v={tahfidz.promotions.map(p => `Juz ${p.juz}`).join(', ')} sukses />
        )}
      </Kartu>

      {tahsin.lastNote && (
        <section className="rounded-2xl bg-primary-wash p-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-primary">
            <MessageSquare className="h-4 w-4" /> Catatan Guru
          </h2>
          <p className="mt-1.5 font-heading text-lg italic leading-snug">&ldquo;{tahsin.lastNote}&rdquo;</p>
        </section>
      )}

      <div className="flex justify-between gap-4 px-1 pt-2 text-xs">
        <div>
          <p className="text-muted-foreground">Mengetahui,</p>
          <p className="text-muted-foreground">Kepala RQ LHI</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">
            Yogyakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-muted-foreground">Wali Halaqoh {student.halaqoh_name ?? ''}</p>
          <p className="mt-6 font-bold">{teacherName ?? 'Wali Halaqoh'}</p>
        </div>
      </div>
    </div>
  )
}

function Kartu({ judul, ikon, nada, children }: {
  judul: string; ikon: React.ReactNode; nada: 'primary' | 'warm'; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card px-4 pb-2 pt-4">
      <h2 className={cn('flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-[0.1em]', nada === 'primary' ? 'text-primary' : 'text-accent-warm')}>
        {ikon}{judul}
      </h2>
      <div className="divide-y border-t">{children}</div>
    </section>
  )
}

function Baris({ k, v, sukses }: { k: string; v: React.ReactNode; sukses?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className={cn('text-right font-bold', sukses && 'text-success')}>{v}</span>
    </div>
  )
}
