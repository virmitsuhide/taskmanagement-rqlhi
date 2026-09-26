import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageKaldik } from '@/lib/auth/permissions'
import { getKaldikTahun, KALDIK_UNIT, type KaldikUnit } from '@/lib/data/kaldik'
import { tanggalWIB } from '@/lib/rq/ujian'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PageTitle } from '@/components/layout/PageTitle'
import { PublicFooter } from '@/components/home/PublicFooter'
import { KalenderTahun } from '@/components/kalender/KalenderTahun'

export const metadata: Metadata = {
  title: "Kalender Pendidikan — Rumah Qur'an LHI",
  description: 'Agenda dan hari libur SDIT & SMPIT LHI sepanjang tahun.',
}

/**
 * Kalender pendidikan — satu alamat untuk seluruh agenda sekolah.
 *
 * Menggantikan aplikasi kaldikrqlhi yang berdiri sendiri (0085), termasuk
 * sifat PUBLIKNYA: kalender lama bisa dibuka siapa saja, dan yang paling
 * sering bertanya "kapan libur semester?" adalah wali murid, bukan
 * koordinator. Isinya pun sudah terbaca di beranda bulan demi bulan, jadi
 * menutupnya tidak menyembunyikan apa pun — ia hanya memaksa orang mengklik
 * dua belas kali.
 *
 * Yang dijaga adalah siapa yang boleh MENGUBAH: tombol suntingnya hanya
 * muncul bagi koordinator unit yang sedang masuk.
 *
 * Tampilannya selalu tampilan situs publik, juga bagi yang sedang masuk:
 * halaman ini dibuka dari beranda, jadi sekelilingnya tetap beranda. Header
 * publik sudah memuat menu akun & tautan dasbor bagi yang masuk.
 */
export default async function KalenderPage() {
  const session = await getSession()
  const tahun = Number(tanggalWIB(new Date()).slice(0, 4))

  const { tabelAda, events } = await getKaldikTahun(tahun)
  const unitBoleh = session
    ? (KALDIK_UNIT.filter(u => canManageKaldik(session.role, u)) as KaldikUnit[])
    : []

  return (
    <div>
      <PublicHeader />

      <div className="mx-auto min-h-[50vh] max-w-5xl space-y-5 p-4 md:p-8">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Beranda
          </Link>
          <PageTitle icon={<CalendarDays className="size-5" aria-hidden />} title={`Kalender Pendidikan ${tahun}`}>
            Agenda dan hari libur sekolah sepanjang tahun. Libur nasional dan kegiatan yayasan selalu ikut tampil di
            semua pilihan unit.
          </PageTitle>
        </div>

        {!tabelAda ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Agenda belum bisa dimuat. Bila ini baru saja dipasang, jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0085_kaldik_events_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor.
          </div>
        ) : (
          <KalenderTahun tahun={tahun} events={events} unitBoleh={unitBoleh} />
        )}
      </div>

      <PublicFooter />
    </div>
  )
}
