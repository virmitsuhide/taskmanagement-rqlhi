import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, CheckCircle2, FileText, HeartHandshake, ListChecks, Sparkles } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHalaqohSesiGuru, pilihHalaqoh } from '@/lib/data/setoran-sesi'
import { getAbsensiTanggal, getSiswaSesi } from '@/lib/data/absensi'
import { getTeacherStudents } from '@/lib/data/teacher'
import { labelTanggalPanjang, type StatusAbsensi } from '@/lib/rq/absensi'
import { tanggalWIB } from '@/lib/rq/ujian'
import { sesiJam } from '@/lib/rq/sesi'
import { sesiBerikutnya } from '@/lib/rq/sesi-berikutnya'
import { AbsensiSesi } from '@/components/guru/AbsensiSesi'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ halaqoh?: string }>
}

/**
 * Mulai sesi — satu layar yang mengikuti urutan kerja di halaqoh:
 * 1) daftar hadir, 2) setoran, 3) catatan setelah sesi.
 *
 * Tidak ada logika baru: daftar hadir memakai komponen & aksi simpan yang sama
 * dengan /guru/absensi, dan setoran diteruskan ke halaman setor per sesi /
 * satu-satu yang sudah ada. Layar ini hanya merangkai urutannya.
 */
export default async function MulaiSesiPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { halaqoh: diminta } = await searchParams
  const daftar = await getHalaqohSesiGuru(session.teacherId)
  // Tanpa ?halaqoh= → halaqoh yang sesinya paling dekat.
  const bawaan = sesiBerikutnya(daftar)?.halaqoh.id
  const halaqoh = pilihHalaqoh(daftar, diminta ?? bawaan)
  const hariIni = tanggalWIB(new Date())

  const [siswaAbsen, absensi, semuaSiswa] = halaqoh
    ? await Promise.all([
        getSiswaSesi(halaqoh.id),
        getAbsensiTanggal(halaqoh.id, hariIni),
        getTeacherStudents(session.teacherId),
      ])
    : [[], { tabelAda: true, baris: [] }, []]

  const awal = Object.fromEntries(
    absensi.baris.map(b => [b.student_id, { status: b.status as StatusAbsensi, catatan: b.catatan }]),
  )
  const sudahAbsen = absensi.baris.length > 0
  const tidakHadir = new Set(absensi.baris.filter(b => b.status !== 'hadir').map(b => b.student_id))

  // Antrian setor: anak halaqoh ini yang hadir, paling lama belum setor di atas.
  const anak = semuaSiswa.filter(s => s.halaqoh_id === halaqoh?.id)
  const sudahSetor = anak.filter(s => s.last_setoran_date === hariIni)
  const antrian = anak
    .filter(s => s.last_setoran_date !== hariIni && !tidakHadir.has(s.id))
    .sort((a, b) => (a.last_setoran_date ?? '').localeCompare(b.last_setoran_date ?? ''))

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">
            Mulai sesi · {labelTanggalPanjang(hariIni)}
          </p>
          <h1 className="mt-1 text-3xl tracking-tight">
            {halaqoh ? halaqoh.name : 'Sesi halaqoh'}
          </h1>
          {halaqoh && (
            <p className="mt-1 text-sm text-muted-foreground">
              {halaqoh.sesi ? `Sesi ${halaqoh.sesi} · ${sesiJam(halaqoh.sesi)}` : 'Tanpa jam sesi'}
              {' · '}{anak.length} siswa · {sudahSetor.length} sudah setor hari ini
            </p>
          )}
        </header>

        {daftar.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Pilih halaqoh">
            {daftar.map(h => (
              <Link
                key={h.id}
                href={`/guru/sesi?halaqoh=${h.id}`}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  h.id === halaqoh?.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {h.name}{h.sesi ? ` · ${sesiJam(h.sesi).split('–')[0]}` : ''}
              </Link>
            ))}
          </nav>
        )}

        {!halaqoh ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum mengampu halaqoh aktif.
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ── Langkah 1: daftar hadir ── */}
            <section className="rounded-2xl border bg-card p-4 md:p-5">
              <Langkah nomor={1} judul="Daftar hadir" selesai={sudahAbsen}
                ket={sudahAbsen ? 'Sudah tersimpan — boleh diubah bila ada yang terlambat.' : 'Semua tertanda hadir. Ubah yang tidak datang, lalu simpan.'} />
              <div className="mt-4">
                {!absensi.tabelAda ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Tabel absensi belum tersedia. Hubungi admin.
                  </p>
                ) : siswaAbsen.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Belum ada siswa aktif di halaqoh ini.
                  </p>
                ) : (
                  <AbsensiSesi key={`${halaqoh.id}|${hariIni}`} halaqohId={halaqoh.id} tanggal={hariIni} siswa={siswaAbsen} awal={awal} />
                )}
              </div>
            </section>

            <div className="space-y-6">
              {/* ── Langkah 2: setoran ── */}
              <section className="rounded-2xl border bg-card p-4 md:p-5">
                <Langkah nomor={2} judul="Setoran" selesai={anak.length > 0 && antrian.length === 0}
                  ket="Isi seluruh halaqoh sekaligus, atau setor satu per satu dari antrian." />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link href={`/guru/setoran/tahsin/sesi?halaqoh=${halaqoh.id}`}
                    className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground transition-opacity hover:opacity-90">
                    <ListChecks className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-semibold leading-tight">Setor tahsin<br /><span className="text-xs font-normal opacity-80">satu sesi sekaligus</span></span>
                  </Link>
                  <Link href={`/guru/setoran/tahfidz/sesi?halaqoh=${halaqoh.id}`}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-primary/40">
                    <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-semibold leading-tight">Setor tahfidz<br /><span className="text-xs font-normal text-muted-foreground">satu sesi sekaligus</span></span>
                  </Link>
                </div>

                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Antrian satu-satu · {antrian.length} belum setor
                  </p>
                  {antrian.length === 0 ? (
                    <p className="mt-2 flex items-center gap-2 rounded-xl bg-success-wash px-3 py-2.5 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" /> Semua anak yang hadir sudah setor.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y rounded-xl border">
                      {antrian.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.lulus_tahsin
                                ? `Tahfidz${s.last_tahfidz_surat ? ` · ${s.last_tahfidz_surat}` : ''}`
                                : s.current_method_name && s.current_jilid_label
                                  ? `${s.current_method_name} ${s.current_jilid_label} · hal. ${s.current_jilid_page ?? '—'}`
                                  : 'Belum ada data tahsin'}
                            </p>
                          </div>
                          <Link
                            href={`${s.lulus_tahsin ? '/guru/setoran/tahfidz/baru' : '/guru/setoran/tahsin/baru'}?student=${s.id}&antrian=${antrian.map(a => a.id).join(',')}`}
                            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                          >
                            Setor
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {tidakHadir.size > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tidakHadir.size} anak tidak hadir tidak masuk antrian.
                    </p>
                  )}
                </div>
              </section>

              {/* ── Langkah 3: setelah sesi ── */}
              <section className="rounded-2xl border bg-card p-4 md:p-5">
                <Langkah nomor={3} judul="Setelah sesi" ket="Opsional — catatan untuk hari ini." />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Pintas href="/guru/adab" icon={<HeartHandshake className="h-4 w-4" />} label="Catatan adab" />
                  <Pintas href="/guru/laporan-ortu" icon={<FileText className="h-4 w-4" />} label="Laporan ortu" />
                  <Pintas href={`/guru/progres`} icon={<BookOpen className="h-4 w-4" />} label="Progres sesi" />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Langkah({ nomor, judul, ket, selesai }: { nomor: number; judul: string; ket: string; selesai?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
        selesai ? 'bg-success text-white' : 'bg-accent-warm-wash text-accent-warm',
      )}>
        {selesai ? <CheckCircle2 className="h-4 w-4" /> : nomor}
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-xl leading-tight">{judul}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{ket}</p>
      </div>
    </div>
  )
}

function Pintas({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/40">
      <span className="text-primary">{icon}</span>{label}
    </Link>
  )
}
