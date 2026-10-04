import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, idHalaqohSesi, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getAbsensiTanggal, getSiswaSesi, getTanggalTerabsen } from '@/lib/data/absensi'
import { tanggalWIB } from '@/lib/rq/ujian'
import { TabDaftarHadir } from '@/components/guru/TabDaftarHadir'
import { hrefDengan } from '@/components/dashboard/kit'
import { DaftarHadirHarian } from './DaftarHadirHarian'
import type { StatusAbsensi } from '@/lib/rq/absensi'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ sesi?: string; tgl?: string }>
}

const PATH = '/guru/absensi'

const tglWIB = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('id-ID', { ...o, timeZone: 'Asia/Jakarta' })

/** Kepingan pilihan (sesi, tanggal) — satu bentuk untuk semua baris pilihan. */
function Keping({ href, aktif, children }: { href: string; aktif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={aktif ? 'page' : undefined}
      className={cn(
        'inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
        aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Daftar hadir per pertemuan.
 *
 * Kehadiran dicatat di sini, bukan diturunkan dari setoran — anak yang datang
 * tapi belum kebagian giliran setor tetap hadir. Angkanya dipakai rapor
 * semester (Hadir / Izin / Alfa). Lihat drizzle/0081.
 */
export default async function AbsensiPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const sp = await searchParams
  const semuaSesi = await getHalaqohSesiGuru(session.teacherId)
  const sesi = pilihHalaqoh(semuaSesi, sp.sesi)
  const hariIni = tanggalWIB(new Date())
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.tgl ?? '') ? sp.tgl! : hariIni

  const params = { sesi: sesi?.id, tgl: tanggal === hariIni ? undefined : tanggal }
  const href = (g: Record<string, string | undefined>) => hrefDengan(PATH, params, g)

  const [siswa, absensi, riwayat] = sesi
    ? await Promise.all([getSiswaSesi(idHalaqohSesi(sesi)), getAbsensiTanggal(idHalaqohSesi(sesi), tanggal), getTanggalTerabsen(idHalaqohSesi(sesi), 8)])
    : [[], { tabelAda: true, baris: [] }, []]

  const awal = Object.fromEntries(
    absensi.baris.map(b => [b.student_id, { status: b.status as StatusAbsensi, catatan: b.catatan }]),
  )

  // Pertemuan yang sudah diabsen — jalan pintas membetulkan absensi kemarin.
  // Tanggal yang sedang dibuka selalu ikut tampil, walau belum pernah diabsen.
  const tanggalLain = [...new Set([...(tanggal !== hariIni ? [tanggal] : []), ...riwayat.filter(t => t !== hariIni)])]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5)

  const labelSesi = (h: (typeof semuaSesi)[number]) =>
    h.sesi && semuaSesi.filter(x => x.sesi === h.sesi).length === 1 ? `Sesi ${h.sesi}` : h.name

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-2xl px-4 pb-6 pt-3 md:px-6 md:pt-6">
        <header className="flex items-center gap-2">
          <Link href="/guru" aria-label="Kembali ke beranda" className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight md:text-lg">Daftar hadir</h1>
            <p className="truncate text-xs text-muted-foreground">
              {sesi ? `${sesi.name} · ` : ''}{tglWIB(tanggal, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </header>

        <div className="mt-2 space-y-[18px]">
          {/* Layar ini menjawab "siapa yang datang hari ini"; rekap sebulan
              menjawab "bagaimana bulan ini", termasuk pertemuan yang terlewat
              diabsen — yang tidak meninggalkan jejak apa pun di sini. */}
          <TabDaftarHadir aktif="harian" />

          {!sesi ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
              Anda belum mengampu halaqoh aktif.
            </div>
          ) : !absensi.tabelAda ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
              Tabel absensi belum ada di basis data. Jalankan{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0081_absensi_harian_PASTE_TO_SUPABASE.sql</code>{' '}
              di Supabase SQL Editor lebih dulu.
            </div>
          ) : (
            <>
              {semuaSesi.length > 1 && (
                <nav aria-label="Pilih sesi" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
                  {semuaSesi.map(h => (
                    <Keping key={h.id} href={href({ sesi: h.id })} aktif={h.id === sesi.id}>{labelSesi(h)}</Keping>
                  ))}
                </nav>
              )}

              <nav aria-label="Pilih tanggal" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
                <Keping href={href({ tgl: undefined })} aktif={tanggal === hariIni}>Hari ini</Keping>
                {tanggalLain.map(t => (
                  <Keping key={t} href={href({ tgl: t })} aktif={t === tanggal}>
                    {tglWIB(t, { weekday: 'short', day: 'numeric' })}
                  </Keping>
                ))}
              </nav>

              {siswa.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                  Belum ada siswa aktif di sesi ini.
                </div>
              ) : (
                // key: berganti sesi/tanggal = daftar baru, bukan sisa centang pertemuan sebelumnya.
                <DaftarHadirHarian key={`${sesi.id}|${tanggal}`} halaqohId={sesi.id} tanggal={tanggal} siswa={siswa} awal={awal} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
