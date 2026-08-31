import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PenLine, ShieldAlert } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { canAccessKpiPublikasi, canPublishKpiRapor } from '@/lib/auth/permissions'
import { getDaftarPublikasi } from '@/lib/data/kpi-pengesahan'
import { KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PublikasiTabel } from './PublikasiTabel'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; year?: string; month?: string }>
}

/**
 * Meja koordinator: rapor KPI yang menunggu tanda tangannya.
 *
 * Terpisah dari /kpi yang dipakai SDM. Yang dikerjakan di sini bukan mengisi
 * nilai melainkan mengesahkan dokumen, dan menumpangkannya pada halaman isian
 * akan memberi koordinator tabel sebelas indikator yang tidak ia sunting,
 * sekaligus menyembunyikan satu-satunya kolom yang ia butuhkan: statusnya.
 */
export default async function PublikasiKpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAccessKpiPublikasi(session.role)) redirect('/kpi')

  // Unit yang boleh ia sahkan saja. Koor SMP yang melihat tab SDIT LHI akan
  // membuka daftar berisi tombol yang seluruhnya ditolak server.
  const unitSaya = KPI_UNITS.filter(u => canPublishKpiRapor(session.role, u.key))
  if (unitSaya.length === 0) redirect('/kpi')

  const p = await searchParams
  const now = new Date()
  const unit = (unitSaya.find(u => u.key === p.unit)?.key ?? unitSaya[0].key) as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1

  const supabase = createServerClient()
  const [rows, { data: profil }] = await Promise.all([
    getDaftarPublikasi(unit, year, month),
    supabase.from('users').select('signature_path').eq('id', session.userId).maybeSingle(),
  ])

  const punyaTtd = Boolean((profil as { signature_path: string | null } | null)?.signature_path)
  const menunggu = rows.filter(r => r.status === 'diajukan')

  const href = (o: { unit?: string; year?: number; month?: number }) => {
    const q = new URLSearchParams({
      unit: o.unit ?? unit,
      year: String(o.year ?? year),
      month: String(o.month ?? month),
    })
    return `/kpi/publikasi?${q}`
  }

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Publikasi Rapor KPI"
        showBack
        ownH1
        breadcrumbs={[{ label: 'KPI Guru', href: '/kpi' }, { label: 'Publikasi Rapor' }]}
      />

      <div className="mx-auto max-w-[1200px] p-4 md:p-6">
        <Link
          href="/kpi"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke KPI bulanan
        </Link>

        <h1 className="text-2xl font-bold leading-tight">Publikasi Rapor KPI</h1>
        <p className="mb-5 mt-0.5 text-sm text-muted-foreground">
          {MONTH_NAMES[month - 1]} {year} · {unitSaya.find(u => u.key === unit)?.label}
          {menunggu.length > 0 && ` · ${menunggu.length} menunggu tanda tangan Anda`}
        </p>

        {/*
          Peringatan tanda tangan ditaruh SEBELUM daftarnya, bukan sebagai galat
          setelah tombol ditekan. Koordinator yang sudah mencentang tiga puluh
          nama lalu ditolak akan kehilangan pilihannya, dan hal yang menghalangi
          sejak awal memang layak diberitahukan sejak awal.
        */}
        {!punyaTtd && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-wash px-3.5 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Tanda tangan Anda belum terpasang</p>
              <p className="mt-0.5 text-muted-foreground">
                Rapor diterbitkan lengkap dengan tanda tangan koordinator.{' '}
                <Link href="/profil" className="font-medium text-foreground underline underline-offset-2">
                  Unggah gambar tanda tangan di Profil Saya
                </Link>{' '}
                lebih dulu — cukup sekali, dipakai untuk semua rapor berikutnya.
              </p>
            </div>
          </div>
        )}

        {unitSaya.length > 1 && (
          <div className="mb-3 flex w-fit gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {unitSaya.map(u => (
              <Link
                key={u.key}
                href={href({ unit: u.key })}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {u.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mb-4 flex gap-1 overflow-x-auto border-b pb-px">
          {MONTH_NAMES.map((m, i) => (
            <Link
              key={m}
              href={href({ month: i + 1 })}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-xs transition-colors',
                month === i + 1
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {m.slice(0, 3)}
            </Link>
          ))}
          <div className="flex-1" />
          {[year - 1, year, year + 1].map(y => (
            <Link
              key={y}
              href={href({ year: y })}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-xs transition-colors',
                year === y
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {y}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-14 text-center">
            <PenLine className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada rapor untuk periode ini</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rapor muncul di sini setelah SDM mengisi nilainya dan mengajukannya kepada Anda.
            </p>
          </div>
        ) : (
          <PublikasiTabel
            rows={rows}
            unit={unit}
            year={year}
            month={month}
            punyaTtd={punyaTtd}
          />
        )}
      </div>
    </div>
  )
}
