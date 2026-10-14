import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewAsrama, canVerifikasiAsrama } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { getPengajuanNonaktif, hitungPengajuan, terapkanPengajuanJatuhTempo, type StatusPengajuan } from '@/lib/data/asrama-status'
import { LABEL_ALASAN, tglPendek } from '@/lib/rq/asrama-status'
import { KartuPengajuan } from '@/components/asrama/KartuPengajuan'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ status?: string; g?: string }>
}

const CHIP = 'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors'
const AKTIF = 'border-primary bg-primary text-primary-foreground'
const PASIF = 'bg-card hover:bg-accent'

const ALUR = [
  'Div Qur’an BPA/BPI mengajukan; anak tetap di kelompok dan tetap bisa disetorkan.',
  'Koor SMP mengonfirmasi ke kesiswaan SMP.',
  'Disetujui: keluar asrama per tanggal efektif — fullday ganti program, pindah sekolah dinonaktifkan.',
  'Ditolak: catatan terlihat oleh pengaju.',
]

/**
 * Pengajuan nonaktif anak asrama (0119) — Koor SMP memverifikasi ke kesiswaan
 * SMP lalu menyetujui/menolak. Pengurus asrama lain boleh melihat.
 */
export default async function PengajuanAsramaPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAsrama(session.role)) redirect('/dashboard')
  const bisaVerifikasi = canVerifikasiAsrama(session.role)

  const q = await searchParams
  const status: Exclude<StatusPengajuan, 'dibatalkan'> = q.status === 'disetujui' || q.status === 'ditolak' ? q.status : 'menunggu'
  const gender = q.g === 'L' || q.g === 'P' ? q.g : undefined

  await terapkanPengajuanJatuhTempo()
  const [daftar, jumlah, riwayat] = await Promise.all([
    getPengajuanNonaktif({ status, gender, batas: 100 }),
    hitungPengajuan(gender),
    getPengajuanNonaktif({ gender, batas: 12 }),
  ])
  const sudahDiputus = riwayat.filter(p => p.status === 'disetujui' || p.status === 'ditolak').slice(0, 4)

  const href = (s: string, g?: string) => {
    const p = new URLSearchParams()
    if (s !== 'menunggu') p.set('status', s)
    if (g) p.set('g', g)
    const t = p.toString()
    return `/asrama/pengajuan${t ? `?${t}` : ''}`
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role}
        breadcrumbs={[{ label: 'Halaqoh Asrama', href: '/asrama' }, { label: 'Pengajuan nonaktif' }]} />
      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-warm">
            {session.role === 'koor_smp' ? 'Koordinator SMP' : 'Halaqoh Asrama'} · Pengajuan nonaktif asrama
          </p>
          <h1 className="mt-2 font-heading text-3xl leading-tight md:text-4xl">
            {jumlah.menunggu === 0
              ? <>Tidak ada pengajuan <em>yang menunggu.</em></>
              : <>{jumlah.menunggu} pengajuan <em>menunggu verifikasi{bisaVerifikasi ? ' Anda' : ''}.</em></>}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Konfirmasikan ke kesiswaan SMP sebelum menyetujui. Persetujuan mengubah status anak di unit SMP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['menunggu', 'disetujui', 'ditolak'] as const).map(s => (
            <Link key={s} href={href(s, gender)} aria-current={s === status ? 'page' : undefined} className={cn(CHIP, s === status ? AKTIF : PASIF)}>
              {s === 'menunggu' ? 'Menunggu' : s === 'disetujui' ? 'Disetujui' : 'Ditolak'}
              <span className={cn('ml-1.5 text-xs', s === status ? 'opacity-80' : 'text-muted-foreground')}>{jumlah[s]}</span>
            </Link>
          ))}
          <span className="mx-1 h-6 w-px bg-border" />
          {([['L', 'Putra · BPA'], ['P', 'Putri · BPI']] as const).map(([g, label]) => (
            <Link key={g} href={href(status, gender === g ? undefined : g)} aria-current={gender === g ? 'page' : undefined}
              className={cn(CHIP, gender === g ? AKTIF : PASIF)}>
              {label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {daftar.length === 0 && (
              <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
                {status === 'menunggu' ? 'Tidak ada pengajuan yang menunggu.' : `Belum ada pengajuan yang ${status}.`}
              </p>
            )}
            {daftar.map((p, i) => <KartuPengajuan key={p.id} p={p} bisaVerifikasi={bisaVerifikasi} terbukaAwal={i === 0} />)}
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-heading text-xl">Alurnya</h2>
              <ol className="mt-3 space-y-3">
                {ALUR.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-heading text-xl">Riwayat</h2>
              {sudahDiputus.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada pengajuan yang diputuskan.</p>
              ) : (
                <ul className="mt-2">
                  {sudahDiputus.map(p => (
                    <li key={p.id} className="border-b py-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold">{p.nama}{p.kelas ? ` · ${p.kelas}` : ''}</p>
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold',
                          p.status === 'disetujui' ? 'bg-success-wash text-success' : 'bg-destructive-wash text-destructive')}>
                          {p.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {LABEL_ALASAN[p.alasan]} · {tglPendek(p.diputuskan_at)}
                        {p.catatan_verifikasi ? ` · “${p.catatan_verifikasi}”` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={href('disetujui', gender)} className="mt-2 inline-block text-sm font-bold text-primary hover:underline">Lihat semua riwayat →</Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
