import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, ChevronLeft, Sparkles } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  getCapaianRiyadhoh, getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu, getSudahSetorRiyadhoh,
  LABEL_CAPAIAN_RIYADHOH, type CapaianRiyadhoh,
} from '@/lib/data/riyadhoh'
import { bintangDariNilai } from '@/lib/rq/bintang'
import { LABEL_KELOMPOK } from '@/lib/rq/riyadhoh'
import { HadirRiyadhoh } from '@/components/riyadhoh/HadirRiyadhoh'
import { PilihSabtu } from '@/components/riyadhoh/PilihSabtu'
import { KartuLangkah, type KeadaanLangkah } from '@/components/riyadhoh/LangkahRiyadhoh'

/**
 * Riyadhoh Sabtu — halaman pengampu. Satu Sabtu dibuka sekaligus sebagai
 * satu alur tiga langkah: catat kehadiran pesertanya, setor tahsin/tahfidz
 * lewat formulir per sesi yang sama dengan halaqoh sekolah, lalu salin
 * laporannya. Setoran itu ikut menjadi capaian sekolah anak (0087).
 */
export default async function RiyadhohGuruPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { tanggal: diminta } = await searchParams
  const sabtu = await getSabtuPengampu(session.teacherId, diminta)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-2xl px-4 pb-6 pt-3 md:px-6 md:pt-6">
        <header className="flex items-center gap-2">
          <Link href="/guru" aria-label="Kembali ke beranda" className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight md:text-lg">Riyadhoh Sabtu</h1>
            <p className="truncate text-xs text-muted-foreground">
              Kelompok {session.fullName}
              {sabtu.terpilih ? ` · ${LABEL_KELOMPOK[sabtu.terpilih.kelompok]}` : ''}
            </p>
          </div>
        </header>

        <div className="mt-2 space-y-4">
          {sabtu.kelompok.length === 0 ? (
            <Kosong>Anda belum ditetapkan sebagai pengampu Riyadhoh. Koordinator SMP yang menetapkannya.</Kosong>
          ) : !sabtu.terpilih ? (
            <Kosong>
              Belum ada Sabtu yang dijadwalkan untuk kelompok {sabtu.kelompok.map(g => LABEL_KELOMPOK[g]).join(' & ')}.
            </Kosong>
          ) : (
            <Isi sabtu={sabtu} teacherId={session.teacherId} />
          )}
        </div>
      </div>
    </div>
  )
}

async function Isi({ sabtu, teacherId }: { sabtu: Awaited<ReturnType<typeof getSabtuPengampu>>; teacherId: string }) {
  const { tanggal, kelompok } = sabtu.terpilih!
  const belumTiba = tanggal > sabtu.hariIni
  const [peserta, hadir, sudah] = await Promise.all([
    getPesertaKelompok(kelompok, teacherId),
    getHadirRiyadhoh(tanggal),
    getSudahSetorRiyadhoh(tanggal),
  ])

  // Angka tiap langkah — semuanya dari data yang sudah dimuat halaman ini.
  const dicatat = peserta.filter(p => hadir[p.id]).length
  const jumlahHadir = peserta.filter(p => hadir[p.id] === 'hadir').length
  // Yang wajib setor: sama dengan formulir setoran — izin/sakit/alfa tidak ikut.
  const wajibSetor = peserta.filter(p => !hadir[p.id] || hadir[p.id] === 'hadir')
  const sudahSetor = wajibSetor.filter(p => sudah.tahsin.has(p.id) || sudah.tahfidz.has(p.id)).length
  const belumSetor = wajibSetor.length - sudahSetor

  // Rincian setoran tiap anak Sabtu ini — satu kueri berkelompok untuk semua
  // peserta (tahsin & tahfidz sekaligus), bukan per anak.
  const capaian = belumTiba ? new Map<string, CapaianRiyadhoh[]>() : await getCapaianRiyadhoh(tanggal, peserta.map(p => p.id))

  const hadirBeres = peserta.length > 0 && dicatat === peserta.length
  const setorBeres = wajibSetor.length > 0 && belumSetor === 0
  const keadaan = (no: 1 | 2 | 3): KeadaanLangkah => {
    if (belumTiba) return 'nanti'
    const kini = !hadirBeres ? 1 : !setorBeres ? 2 : 3
    if (no === 1 && hadirBeres) return 'selesai'
    if (no === 2 && setorBeres) return 'selesai'
    return no === kini ? 'kini' : 'nanti'
  }

  const tanggalTeks = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
  const q = `?tanggal=${tanggal}`

  return (
    <>
      <PilihSabtu daftar={sabtu.daftar} terpilih={tanggal} hariIni={sabtu.hariIni} />

      <section className="rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-warm-wash">
          {tanggalTeks} · {LABEL_KELOMPOK[kelompok]}
        </p>
        <p className="mt-1.5 font-heading text-[22px] leading-snug">
          {peserta.length} peserta kelompok Anda{' '}
          <em>
            {belumTiba
              ? '— Sabtu ini belum tiba.'
              : peserta.length === 0
                ? ''
                : belumSetor > 0
                  ? `— ${belumSetor} belum setor.`
                  : '— semua sudah setor.'}
          </em>
        </p>
        {belumTiba && (
          <p className="mt-1 text-xs opacity-80">Kehadiran &amp; setoran dicatat pada harinya.</p>
        )}
      </section>

      {peserta.length > 0 && (
        <div className="space-y-2.5">
          <KartuLangkah
            no={1}
            judul="Kehadiran"
            keadaan={keadaan(1)}
            href={belumTiba ? undefined : '#kehadiran'}
            sub={belumTiba ? 'dicatat pada harinya' : `${jumlahHadir}/${peserta.length} hadir · ${hadirBeres ? 'tersimpan' : `${peserta.length - dicatat} belum disimpan`}`}
          />
          <KartuLangkah
            no={2}
            judul="Setoran"
            keadaan={keadaan(2)}
            sub={belumTiba ? 'dibuka pada harinya' : `${sudahSetor} dari ${wajibSetor.length} sudah setor`}
            aksi={belumTiba ? undefined : (
              <span className="flex shrink-0 gap-3 text-xs font-bold text-primary">
                <Link href={`/guru/riyadhoh/tahsin${q}`} className="hover:underline">Tahsin</Link>
                <Link href={`/guru/riyadhoh/tahfidz${q}`} className="hover:underline">Tahfidz</Link>
              </span>
            )}
          />
          <KartuLangkah
            no={3}
            judul="Laporan"
            keadaan={keadaan(3)}
            href={belumTiba ? undefined : `/guru/riyadhoh/laporan${q}`}
            sub="salin ke grup WhatsApp"
          />
        </div>
      )}

      {peserta.length === 0 ? (
        <Kosong>Belum ada anak {LABEL_KELOMPOK[kelompok].toLowerCase()} di kelompok Riyadhoh Anda. Koordinator SMP yang menetapkan anak ke tiap pengampu.</Kosong>
      ) : (
        <HadirRiyadhoh
          key={tanggal}
          tanggal={tanggal}
          terkunci={belumTiba}
          peserta={peserta.map(p => ({
            id: p.id,
            nama: p.full_name,
            kelas: p.kelas,
            halaqoh: p.halaqoh_name,
            tahsin: sudah.tahsin.has(p.id),
            tahfidz: sudah.tahfidz.has(p.id),
            capaian: (capaian.get(p.id) ?? []).map(c => ({
              jenis: c.jenis,
              label: LABEL_CAPAIAN_RIYADHOH[c.jenis],
              teks: c.teks,
              bintang: teksBintang(c.nilai),
              ulang: c.ulang,
            })),
            // Setor tahsin satu-satu sudah mendukung anak terpilih + tanggal
            // Sabtu terkunci. Tahfidz Riyadhoh hanya lewat formulir per sesi
            // (tanpa pilihan anak), jadi tautannya ke formulir itu.
            hrefTahsin: `/guru/setoran/tahsin/baru?riyadhoh=${tanggal}&student=${p.id}`,
            hrefTahfidz: `/guru/riyadhoh/tahfidz${q}`,
          }))}
          hadir={hadir}
        />
      )}

      {!belumTiba && peserta.length > 0 && (
        <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
          <Link href={`/guru/riyadhoh/tahsin${q}`}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl border bg-card text-sm font-bold hover:bg-accent">
            <BookOpen className="size-4" /> Setor tahsin
          </Link>
          <Link href={`/guru/riyadhoh/tahfidz${q}`}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
            <Sparkles className="size-4" /> Setor tahfidz
          </Link>
        </div>
      )}
    </>
  )
}

function teksBintang(n: number | null): string {
  if (n === null) return ''
  const b = bintangDariNilai(n)
  return b ? `${'★'.repeat(Math.floor(b))}${b % 1 ? '½' : ''}` : ''
}

function Kosong({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">{children}</div>
}
