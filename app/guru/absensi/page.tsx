import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getAbsensiTanggal, getSiswaSesi, getTanggalTerabsen } from '@/lib/data/absensi'
import { labelTanggalPanjang } from '@/lib/rq/absensi'
import { tanggalWIB } from '@/lib/rq/ujian'
import { CalendarRange } from 'lucide-react'
import { Slicer, hrefDengan } from '@/components/dashboard/kit'
import { AbsensiSesi } from '@/components/guru/AbsensiSesi'
import type { StatusAbsensi } from '@/lib/rq/absensi'

interface PageProps {
  searchParams: Promise<{ sesi?: string; tgl?: string }>
}

const PATH = '/guru/absensi'

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
    ? await Promise.all([getSiswaSesi(sesi.id), getAbsensiTanggal(sesi.id, tanggal), getTanggalTerabsen(sesi.id, 8)])
    : [[], { tabelAda: true, baris: [] }, []]

  const awal = Object.fromEntries(
    absensi.baris.map(b => [b.student_id, { status: b.status as StatusAbsensi, catatan: b.catatan }]),
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Setoran</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Daftar Hadir
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kehadiran satu pertemuan. Angkanya dipakai rapor semester — hadir, izin, sakit, alfa.
          </p>
          {/* Layar ini menjawab "siapa yang datang hari ini"; rekap sebulan
              menjawab "bagaimana bulan ini", termasuk pertemuan yang terlewat
              diabsen — yang tidak meninggalkan jejak apa pun di sini. */}
          <Link
            href="/guru/absensi/rekap"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            <CalendarRange className="h-4 w-4" /> Rekap sebulan
          </Link>
        </div>

        {!sesi ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh aktif.
          </div>
        ) : !absensi.tabelAda ? (
          <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
            Tabel absensi belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0081_absensi_harian_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu.
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border bg-card p-4">
              {semuaSesi.length > 1 && (
                <Slicer label="Sesi" options={semuaSesi.map(h => ({
                  label: h.sesi && semuaSesi.filter(x => x.sesi === h.sesi).length === 1 ? `Sesi ${h.sesi}` : h.name,
                  href: href({ sesi: h.id }), active: h.id === sesi.id,
                }))} />
              )}

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tanggal</p>
                <p className="mt-0.5 font-semibold">{labelTanggalPanjang(tanggal)}</p>
                {/* Pertemuan yang sudah diabsen — jalan pintas membetulkan absensi kemarin. */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {tanggal !== hariIni && (
                    <Link href={href({ tgl: undefined })} className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent">
                      Hari ini
                    </Link>
                  )}
                  {riwayat.filter(t => t !== tanggal).slice(0, 5).map(t => (
                    <Link key={t} href={href({ tgl: t })} className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent">
                      {new Date(`${t}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {siswa.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
                Belum ada siswa aktif di sesi ini.
              </div>
            ) : (
              // key: berganti sesi/tanggal = daftar baru, bukan sisa centang pertemuan sebelumnya.
              <AbsensiSesi key={`${sesi.id}|${tanggal}`} halaqohId={sesi.id} tanggal={tanggal} siswa={siswa} awal={awal} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
