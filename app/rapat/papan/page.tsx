import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, ClipboardCheck, Gavel, ListTodo, MessagesSquare, Wallet, UserX, ExternalLink, Check,
} from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canDecideRapatApproval, canIsiBiayaRapat, canKelolaPapanRapat, getViewableMeetingTypes, MEETING_TYPE_LABELS,
} from '@/lib/auth/permissions'
import { getPapanRapat, type PoinPapan } from '@/lib/data/papan-rapat'
import { menungguBiaya, sudahTuntas, LABEL_STATUS_TUGAS, WARNA_STATUS_TUGAS } from '@/lib/rapat/papan'
import { formatRupiah } from '@/lib/finance/period'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop, Panel, Slicer, KpiCard, MonthStepper, hrefDengan } from '@/components/dashboard/kit'
import { Markdown } from '@/components/ui/markdown'
import { AksiApproval, AksiArsip, AksiDiskusi, FormBiaya } from '@/components/rapat/PapanAksi'
import { cn } from '@/lib/utils'
import type { MeetingType, UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ tampil?: string; jenis?: string; bulan?: string }>
}

const PATH = '/rapat/papan'
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function bulanIni(): string {
  const d = new Date(Date.now() + 7 * 3600_000) // WIB
  return d.toISOString().slice(0, 7)
}
function geserBulan(kunci: string, n: number): string {
  const [y, m] = kunci.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
function labelBulan(kunci: string): string {
  const [y, m] = kunci.split('-').map(Number)
  return `${BULAN[m - 1]} ${y}`
}
function tgl(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

/**
 * Papan Rapat — hasil rapat yang masih perlu diurus, dari seluruh notulen yang
 * boleh dibaca pengguna. Tata letak Z:
 *
 *   judul ─────────────────────────────► tampilan · jenis rapat
 *   ◄────────────── 4 KPI antrean ────────────────
 *   approval ──────► tindak lanjut ──────► diskusi lanjut
 *   tabel keputusan bulanan ───────────► approval disetujui & biaya
 */
export default async function PapanRapatPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  const bolehJenis = getViewableMeetingTypes(session.role)
  if (bolehJenis.length === 0) redirect('/rapat')

  const sp = await searchParams
  const arsip = sp.tampil === 'arsip'
  const jenis = bolehJenis.includes(sp.jenis as MeetingType) ? (sp.jenis as MeetingType) : null
  const kini = bulanIni()
  const semuaBulan = sp.bulan === 'semua'
  const bulan = semuaBulan ? null : /^\d{4}-\d{2}$/.test(sp.bulan ?? '') && sp.bulan! <= kini ? sp.bulan! : kini

  const papan = await getPapanRapat(session.role, { arsip, jenis, bulan })

  const params = { tampil: arsip ? 'arsip' : undefined, jenis: jenis ?? undefined, bulan: sp.bulan }
  const href = (ganti: Record<string, string | undefined>) => hrefDengan(PATH, params, ganti)

  const approval = papan.poin.filter(p => p.tag === 'approval')
  const tindakLanjut = papan.poin.filter(p => p.tag === 'tindak_lanjut')
  const diskusi = papan.poin.filter(p => p.tag === 'perlu_diskusi')
  // Yang sudah tuntas turun ke bawah kolom — yang masih perlu diurus terbaca dulu.
  const urut = (xs: PoinPapan[]) => [...xs].sort((a, b) => Number(sudahTuntas(a, a.tugas)) - Number(sudahTuntas(b, b.tugas)))

  const nMenunggu = approval.filter(p => p.approval_status === 'menunggu').length
  const nBiaya = approval.filter(menungguBiaya).length
  const nTL = tindakLanjut.filter(p => !sudahTuntas(p, p.tugas)).length
  const nTanpaPic = tindakLanjut.filter(p => p.tugas.length === 0).length
  const nDiskusi = diskusi.filter(p => !p.selesai_at).length
  const totalBiaya = papan.disetujui.reduce((n, p) => n + (p.biaya ?? 0), 0)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Papan Rapat"
        breadcrumbs={[{ label: 'Rapat & Notulen', href: '/rapat' }, { label: 'Papan Rapat' }]}
        ownH1
      />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <DashTop
          eyebrow="Rapat & Notulen"
          title="Papan Rapat"
          context={<>{jenis ? MEETING_TYPE_LABELS[jenis] : 'Semua rapat yang bisa Anda baca'} · {arsip ? 'arsip' : `${papan.poin.length} poin aktif`}</>}
          filters={
            <>
              <Slicer label="Tampilan" options={[
                { label: 'Papan aktif', href: href({ tampil: undefined }), active: !arsip },
                { label: 'Arsip', href: href({ tampil: 'arsip' }), active: arsip },
              ]} />
              {bolehJenis.length > 1 && (
                <Slicer label="Jenis rapat" options={[
                  { label: 'Semua', href: href({ jenis: undefined }), active: !jenis },
                  ...bolehJenis.map(j => ({ label: MEETING_TYPE_LABELS[j].replace(/^Rapat /, ''), href: href({ jenis: j }), active: jenis === j })),
                ]} />
              )}
            </>
          }
        />

        {!arsip && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Approval menunggu" value={nMenunggu}
              sub={canDecideRapatApproval(session.role) ? 'Menunggu keputusan Anda' : 'Menunggu keputusan Kepala RQ'} />
            <KpiCard icon={<Wallet className="h-3.5 w-3.5" />} label="Biaya belum diisi" value={nBiaya}
              sub={canIsiBiayaRapat(session.role) ? 'Wajib Anda isi' : 'Menunggu bendahara'} />
            <KpiCard icon={<ListTodo className="h-3.5 w-3.5" />} label="Tindak lanjut berjalan" value={nTL}
              sub={nTanpaPic > 0 ? `${nTanpaPic} belum punya PIC` : 'Semua sudah punya PIC'} />
            <KpiCard icon={<MessagesSquare className="h-3.5 w-3.5" />} label="Diskusi lanjut terbuka" value={nDiskusi}
              sub="Bawa ke rapat berikutnya" />
          </div>
        )}

        {/* ── Tiga kolom papan ── */}
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Kolom judul="Approval" ikon={<ClipboardCheck className="h-4 w-4" />} jumlah={approval.length}
            kosong={arsip ? 'Belum ada approval di arsip.' : 'Tidak ada approval yang perlu diurus.'}>
            {urut(approval).map(p => <KartuApproval key={p.id} p={p} role={session.role} arsip={arsip} />)}
          </Kolom>
          <Kolom judul="Tindak Lanjut" ikon={<ListTodo className="h-4 w-4" />} jumlah={tindakLanjut.length}
            kosong={arsip ? 'Belum ada tindak lanjut di arsip.' : 'Tidak ada tindak lanjut yang berjalan.'}>
            {urut(tindakLanjut).map(p => <KartuTindakLanjut key={p.id} p={p} role={session.role} arsip={arsip} />)}
          </Kolom>
          <Kolom judul="Perlu Diskusi Lanjut" ikon={<MessagesSquare className="h-4 w-4" />} jumlah={diskusi.length}
            kosong={arsip ? 'Belum ada diskusi di arsip.' : 'Tidak ada diskusi yang menggantung.'}>
            {urut(diskusi).map(p => <KartuDiskusi key={p.id} p={p} role={session.role} arsip={arsip} />)}
          </Kolom>
        </div>

        {/* ── Rekap bulanan: keputusan ► approval disetujui ── */}
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[1.8px] text-muted-foreground">Rekap Bulanan</h2>
            <p className="text-xs text-muted-foreground">
              Keputusan menurut tanggal rapat · approval menurut tanggal disetujui{jenis ? ` · ${MEETING_TYPE_LABELS[jenis]}` : ''}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <MonthStepper
              label="Bulan"
              current={bulan ? labelBulan(bulan) : 'Semua bulan'}
              prevHref={href({ bulan: geserBulan(bulan ?? kini, bulan ? -1 : 0) })}
              nextHref={bulan && bulan < kini ? href({ bulan: geserBulan(bulan, 1) === kini ? undefined : geserBulan(bulan, 1) }) : null}
            />
            <Slicer label="Rentang" options={[
              { label: 'Per bulan', href: href({ bulan: undefined }), active: !semuaBulan },
              { label: 'Semua', href: href({ bulan: 'semua' }), active: semuaBulan },
            ]} />
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-12">
          <Panel className="lg:col-span-7" title="Keputusan Rapat" icon={<Gavel className="h-4 w-4" />}
            sub={`${papan.keputusan.length.toLocaleString('id-ID')} keputusan · ${bulan ? labelBulan(bulan) : 'semua bulan'}`}>
            {papan.keputusan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada keputusan tercatat {bulan ? `pada ${labelBulan(bulan)}` : ''}.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="w-24 pb-2 pr-3 font-medium">Tanggal</th>
                      <th className="pb-2 pr-3 font-medium">Keputusan</th>
                      <th className="w-40 pb-2 font-medium">Rapat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papan.keputusan.map(p => (
                      <tr key={p.id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap py-2.5 pr-3 text-xs tabular-nums text-muted-foreground">{tgl(p.rapat.date)}</td>
                        <td className="py-2.5 pr-3"><Markdown content={p.discussion} className="text-sm" /></td>
                        <td className="py-2.5 text-xs">
                          <Link href={`/rapat/${p.rapat.id}`} className="font-medium hover:underline">{p.rapat.subject}</Link>
                          <span className="block text-muted-foreground">{MEETING_TYPE_LABELS[p.rapat.type]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel className="lg:col-span-5" title="Approval Disetujui" icon={<CheckCircle2 className="h-4 w-4" />}
            sub={`${papan.disetujui.length} disetujui · total biaya ${formatRupiah(totalBiaya)}`}>
            {papan.disetujui.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada approval disetujui {bulan ? `pada ${labelBulan(bulan)}` : ''}.</p>
            ) : (
              <ul className="divide-y">
                {papan.disetujui.map(p => (
                  <li key={p.id} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Markdown content={p.discussion} className="line-clamp-2 text-sm" />
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {p.approval_at ? tgl(p.approval_at) : '—'} · <Link href={`/rapat/${p.rapat.id}`} className="hover:underline">{p.rapat.subject}</Link>
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      {!p.butuh_biaya ? (
                        <span className="text-muted-foreground">Tanpa biaya</span>
                      ) : p.biaya !== null ? (
                        <span className="font-semibold">{formatRupiah(p.biaya)}</span>
                      ) : (
                        <span className="rounded-full bg-warning-wash px-2 py-0.5 text-[11px] text-warning">Biaya belum diisi</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ─── Kolom & kartu ───────────────────────────────────────────────────────────

function Kolom({ judul, ikon, jumlah, kosong, children }: {
  judul: string; ikon: React.ReactNode; jumlah: number; kosong: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-muted/40 p-3">
      <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
        {ikon}{judul}
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{jumlah}</span>
      </h2>
      {jumlah === 0 ? (
        <p className="rounded-lg border border-dashed bg-card/60 px-3 py-6 text-center text-xs text-muted-foreground">{kosong}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </section>
  )
}

function Kartu({ p, children, tuntas, aksi }: {
  p: PoinPapan; children: React.ReactNode; tuntas: boolean; aksi?: React.ReactNode
}) {
  return (
    <article className={cn('rounded-lg border bg-card p-3.5 shadow-xs', tuntas && 'opacity-80')}>
      <Link href={`/rapat/${p.rapat.id}`} className="mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
        <span className="truncate">{p.rapat.subject}</span>
        <span className="shrink-0">· {tgl(p.rapat.date)}</span>
      </Link>
      <div className="space-y-2.5">{children}</div>
      {aksi && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5">{aksi}</div>}
    </article>
  )
}

function Lencana({ warna, children }: { warna: 'success' | 'warning' | 'destructive' | 'info' | 'muted'; children: React.ReactNode }) {
  const gaya = warna === 'muted'
    ? { background: 'var(--muted)', color: 'var(--muted-foreground)' }
    : { background: `var(--${warna}-wash)`, color: `var(--${warna})` }
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={gaya}>{children}</span>
}

function KartuApproval({ p, role, arsip }: { p: PoinPapan; role: UserRole; arsip: boolean }) {
  const tuntas = sudahTuntas(p)
  const status = p.approval_status ?? 'menunggu'
  const bolehPutus = !arsip && canDecideRapatApproval(role)
  const bolehBiaya = !arsip && canIsiBiayaRapat(role) && status === 'disetujui' && p.butuh_biaya
  const bolehArsip = canKelolaPapanRapat(role, p.rapat.type) || canDecideRapatApproval(role) || canIsiBiayaRapat(role)

  return (
    <Kartu p={p} tuntas={tuntas} aksi={
      (bolehPutus && (status === 'menunggu' || p.biaya === null)) || (bolehArsip && (tuntas || arsip)) ? (
        <>
          {bolehPutus && (status === 'menunggu' || p.biaya === null) && <AksiApproval id={p.id} status={status} />}
          {bolehArsip && (arsip || tuntas) && <span className="ml-auto"><AksiArsip id={p.id} arsip={!arsip} /></span>}
        </>
      ) : undefined
    }>
      <div className="flex flex-wrap gap-1.5">
        {status === 'menunggu' && <Lencana warna="warning">Menunggu keputusan</Lencana>}
        {status === 'disetujui' && <Lencana warna="success"><Check className="h-3 w-3" />Disetujui</Lencana>}
        {status === 'ditolak' && <Lencana warna="destructive">Ditolak</Lencana>}
        {p.butuh_biaya && <Lencana warna="muted"><Wallet className="h-3 w-3" />Butuh biaya</Lencana>}
      </div>
      <Markdown content={p.discussion} className="line-clamp-4 text-sm" />
      {status !== 'menunggu' && (
        <p className="text-[11px] text-muted-foreground">
          {status === 'disetujui' ? 'Disetujui' : 'Ditolak'}{p.approval_oleh ? ` oleh ${p.approval_oleh}` : ''}{p.approval_at ? ` · ${tgl(p.approval_at)}` : ''}
        </p>
      )}
      {status === 'disetujui' && p.butuh_biaya && (
        <div className="rounded-md border p-2.5" style={p.biaya === null ? { background: 'var(--warning-wash)', borderColor: 'transparent' } : undefined}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Biaya</p>
          {p.biaya !== null && (
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{formatRupiah(p.biaya)}</span>
              {p.biaya_catatan && <span className="text-muted-foreground"> · {p.biaya_catatan}</span>}
              {p.biaya_oleh && <span className="block text-[11px] text-muted-foreground">dicatat {p.biaya_oleh}</span>}
            </p>
          )}
          {p.biaya === null && !bolehBiaya && <p className="text-xs text-warning">Menunggu bendahara mengisi biaya.</p>}
          {bolehBiaya && <div className={p.biaya !== null ? 'mt-2' : ''}><FormBiaya id={p.id} biaya={p.biaya} catatan={p.biaya_catatan} /></div>}
        </div>
      )}
    </Kartu>
  )
}

function KartuTindakLanjut({ p, role, arsip }: { p: PoinPapan; role: UserRole; arsip: boolean }) {
  const tuntas = sudahTuntas(p, p.tugas)
  const bolehArsip = canKelolaPapanRapat(role, p.rapat.type)
  const buatTask = `/tasks/baru?meeting_id=${p.rapat.id}&agenda_id=${p.id}&title=${encodeURIComponent(p.follow_up ?? '')}`
  return (
    <Kartu p={p} tuntas={tuntas} aksi={
      !arsip || bolehArsip ? (
        <>
          {!arsip && (
            <Link href={buatTask} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />{p.tugas.length === 0 ? 'Buat task & tunjuk PIC' : 'Tambah task'}
            </Link>
          )}
          {bolehArsip && (arsip || tuntas) && <span className="ml-auto"><AksiArsip id={p.id} arsip={!arsip} /></span>}
        </>
      ) : undefined
    }>
      {p.follow_up && <p className="text-sm font-medium">{p.follow_up}</p>}
      <Markdown content={p.discussion} className={cn('line-clamp-2', p.follow_up ? 'text-xs text-muted-foreground' : 'text-sm')} />
      {p.tugas.length === 0 ? (
        <p className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs" style={{ background: 'var(--warning-wash)', color: 'var(--warning)' }}>
          <UserX className="h-3.5 w-3.5" />Belum ada PIC — buat task dari poin ini.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {p.tugas.map(t => (
            <li key={t.id}>
              <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 hover:bg-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WARNA_STATUS_TUGAS[t.status] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{t.pic ?? 'Tanpa PIC'}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{t.title}</span>
                </span>
                <span className="shrink-0 text-[11px] font-medium" style={{ color: WARNA_STATUS_TUGAS[t.status] }}>
                  {LABEL_STATUS_TUGAS[t.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tuntas && <Lencana warna="success"><Check className="h-3 w-3" />Semua task selesai</Lencana>}
    </Kartu>
  )
}

function KartuDiskusi({ p, role, arsip }: { p: PoinPapan; role: UserRole; arsip: boolean }) {
  const selesai = p.selesai_at !== null
  const boleh = canKelolaPapanRapat(role, p.rapat.type)
  return (
    <Kartu p={p} tuntas={selesai} aksi={
      boleh ? (
        <>
          {!arsip && <AksiDiskusi id={p.id} selesai={selesai} />}
          {(arsip || selesai) && <span className="ml-auto"><AksiArsip id={p.id} arsip={!arsip} /></span>}
        </>
      ) : undefined
    }>
      <Markdown content={p.discussion} className="line-clamp-4 text-sm" />
      {selesai
        ? <Lencana warna="success"><Check className="h-3 w-3" />Selesai · {tgl(p.selesai_at!)}</Lencana>
        : <Lencana warna="info"><MessagesSquare className="h-3 w-3" />Menunggu dibahas</Lencana>}
    </Kartu>
  )
}
