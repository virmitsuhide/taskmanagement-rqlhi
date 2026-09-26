import type { Metadata } from 'next'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Button } from '@/components/ui/button'
import { AntrianUjian } from '@/components/ujian/AntrianUjian'
import { UjianTabPublik } from '@/components/ujian/UjianTabPublik'
import { getAntrianUjian } from '@/lib/data/ujian'
import { getSession } from '@/lib/auth/session'
import { canViewUjian } from '@/lib/auth/permissions'

export const metadata: Metadata = {
  title: "Antrian Ujian — Rumah Qur'an LHI",
  description: 'Cek antrian dan jadwal ujian tahsin & tahfidz SDIT dan SMPIT LHI tanpa perlu masuk akun.',
}

const ALUR = [
  { t: 'Diajukan', d: 'Guru pengampu mengajukan setelah anak menuntaskan jilid atau juznya.', c: 'bg-accent-warm' },
  { t: 'Terjadwal', d: 'Koordinator menetapkan tanggal, jam, dan penguji.', c: 'bg-info' },
  { t: 'Selesai', d: 'Hasil tampil di Rekap Hasil dan disampaikan lewat ustadz/ustadzah.', c: 'bg-primary' },
]

const TANYA = [
  { q: 'Siapa yang mengajukan ujian anak saya?', a: 'Guru pengampu halaqoh, setelah anak menuntaskan jilid atau juznya. Orang tua tidak perlu mendaftar sendiri.' },
  { q: 'Kenapa nama anak tampil singkat?', a: 'Halaman ini terbuka untuk umum, jadi nama yang tampil adalah nama singkat yang disiapkan untuk publikasi. Nilai rinci disampaikan lewat ustadz/ustadzah.' },
  { q: 'Anak saya belum muncul di antrian.', a: 'Artinya ujian belum diajukan. Silakan tanyakan kepada pengampu halaqoh anak Anda.' },
]

export default async function AntrianUjianPage() {
  const [{ tahfidz, tahsin }, session] = await Promise.all([getAntrianUjian(), getSession()])
  const bolehKelola = Boolean(session && canViewUjian(session.role))

  return (
    <div className="bg-background">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-8 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Ujian tahsin &amp; tahfidz</p>
            <h1 className="mt-3 font-heading text-[clamp(36px,5.5vw,64px)] font-normal leading-[1.02] tracking-[-0.02em]">
              Kapan anak saya <span className="italic text-primary">diuji?</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Cek antrian dan jadwal ujian SDIT &amp; SMPIT LHI tanpa perlu masuk akun.
            </p>
          </div>
          {bolehKelola && (
            <Button asChild size="sm" variant="outline">
              <Link href="/ujian/kelola"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Kelola pengajuan</Link>
            </Button>
          )}
        </div>
        <div className="mt-8">
          <UjianTabPublik aktif="antrian" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <AntrianUjian tahfidz={tahfidz} tahsin={tahsin} />
      </div>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:px-8 md:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Alur ujian</p>
          <h2 className="mt-3 font-heading text-3xl font-normal leading-tight md:text-[40px]">Dari pengajuan guru sampai hasil</h2>
          <ol className="mt-6 space-y-4">
            {ALUR.map((a, i) => (
              <li key={a.t} className="flex items-start gap-3.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${a.c}`}>{i + 1}</span>
                <span>
                  <b className="block text-[15px]">{a.t}</b>
                  <span className="text-sm text-muted-foreground">{a.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          {TANYA.map(t => (
            <details key={t.q} className="group border-t py-5 last:border-b">
              <summary className="cursor-pointer list-none text-[16px] font-bold marker:hidden">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>{t.q}
              </summary>
              <p className="mt-2.5 pl-5 text-[14.5px] leading-relaxed text-muted-foreground">{t.a}</p>
            </details>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
