import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getHadirTR, getKelompokTRGuru, getPesertaTR, getSetoranTR, hariIniTR } from '@/lib/data/tahsin-rekomendasi'
import { jumatTerakhir, jumatTerbuka } from '@/lib/rq/tahsin-rekomendasi'
import { bintangDariNilai } from '@/lib/rq/bintang'
import { HadirTR } from '@/components/tahsin-rekomendasi/HadirTR'
import { PilihJumat } from '@/components/tahsin-rekomendasi/PilihJumat'
import { KartuLangkah, type KeadaanLangkah } from '@/components/riyadhoh/LangkahRiyadhoh'

/**
 * Tahsin Rekomendasi — halaman akun pengampu (TR1, TR2, …). Satu Jum'at
 * dibuka sekaligus: catat kehadiran, lalu setor tahsin lewat formulir per
 * sesi yang sama dengan halaqoh sekolah. Setorannya ikut menjadi capaian
 * tahsin sekolah anak (0115).
 */
export default async function TahsinRekomendasiGuruPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const kelompok = await getKelompokTRGuru(session.teacherId)
  const hariIni = hariIniTR()
  const terbuka = jumatTerbuka(hariIni)
  const { tanggal: diminta } = await searchParams
  const tanggal = diminta && terbuka.includes(diminta) ? diminta : jumatTerakhir(hariIni)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-2xl px-4 pb-6 pt-3 md:px-6 md:pt-6">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-warm">Tahsin Rekomendasi · SDIT LHI</p>
          <h1 className="font-heading text-2xl leading-tight md:text-3xl">{kelompok ? `Kelompok ${kelompok.full_name}` : 'Tahsin Rekomendasi'}</h1>
          {kelompok && (
            <p className="text-xs text-muted-foreground">
              Akun {kelompok.username}{kelompok.tempat ? ` · ${kelompok.tempat}` : ''} · tiap Jum&apos;at sore
            </p>
          )}
        </header>

        <div className="mt-3 space-y-4">
          {!kelompok ? (
            <Kosong>Akun ini bukan pengampu Tahsin Rekomendasi. Koordinator SD yang mengaturnya.</Kosong>
          ) : (
            <Isi teacherId={session.teacherId} tanggal={tanggal} terbuka={terbuka} hariIni={hariIni} />
          )}
        </div>
      </div>
    </div>
  )
}

async function Isi({ teacherId, tanggal, terbuka, hariIni }: { teacherId: string; tanggal: string; terbuka: string[]; hariIni: string }) {
  const peserta = await getPesertaTR(teacherId)
  const ids = peserta.map(p => p.id)
  const [hadir, setoran] = await Promise.all([getHadirTR(tanggal, ids), getSetoranTR(tanggal, ids)])

  const dicatat = peserta.filter(p => hadir[p.id]).length
  const jumlahHadir = peserta.filter(p => hadir[p.id] === 'hadir').length
  // Yang wajib setor: sama dengan formulir setoran — izin/sakit/alfa tidak ikut.
  const wajibSetor = peserta.filter(p => !hadir[p.id] || hadir[p.id] === 'hadir')
  const sudahSetor = wajibSetor.filter(p => setoran.has(p.id)).length
  const belumSetor = wajibSetor.length - sudahSetor

  const hadirBeres = peserta.length > 0 && dicatat === peserta.length
  const setorBeres = wajibSetor.length > 0 && belumSetor === 0
  const keadaan = (no: 1 | 2): KeadaanLangkah => {
    if (no === 1) return hadirBeres ? 'selesai' : 'kini'
    return setorBeres ? 'selesai' : hadirBeres ? 'kini' : 'nanti'
  }

  const tanggalTeks = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
  const hrefSetor = `/guru/tahsin-rekomendasi/setor?tanggal=${tanggal}`

  return (
    <>
      <PilihJumat daftar={[...terbuka].reverse()} terpilih={tanggal} hariIni={hariIni} />

      <section className="rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-warm-wash">{tanggalTeks}</p>
        <p className="mt-1.5 font-heading text-[22px] leading-snug">
          {peserta.length} peserta kelompok Anda{' '}
          <em>{peserta.length === 0 ? '' : belumSetor > 0 ? `— ${belumSetor} belum setor.` : '— semua sudah setor.'}</em>
        </p>
        <p className="mt-1 text-xs opacity-80">Setoran di sini ikut menjadi capaian tahsin sekolah anak; guru halaqohnya melanjutkan dari sini.</p>
      </section>

      {peserta.length === 0 ? (
        <Kosong>Belum ada siswa di kelompok Anda. Koordinator SD yang memasukkan siswa ke tiap kelompok.</Kosong>
      ) : (
        <>
          <div className="space-y-2.5">
            <KartuLangkah no={1} judul="Kehadiran" keadaan={keadaan(1)} href="#kehadiran"
              sub={`${jumlahHadir}/${peserta.length} hadir · ${hadirBeres ? 'tersimpan' : `${peserta.length - dicatat} belum disimpan`}`} />
            <KartuLangkah no={2} judul="Setoran tahsin" keadaan={keadaan(2)} href={hrefSetor}
              sub={`${sudahSetor} dari ${wajibSetor.length} sudah setor`} />
          </div>

          <HadirTR
            key={tanggal}
            tanggal={tanggal}
            hadir={hadir}
            peserta={peserta.map(p => ({
              id: p.id,
              nama: p.full_name,
              kelas: p.kelas,
              posisi: p.lulus_tahsin ? 'Lulus Tahsin' : p.posisi ? `${p.posisi}${p.drill ? ' (drill)' : ''}` : null,
              setoran: (setoran.get(p.id) ?? []).map(s => ({ teks: s.teks, status: s.status, bintang: teksBintang(s.nilai) })),
            }))}
          />

          <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
            <Link href={hrefSetor}
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
              <BookOpen className="size-4" /> Setor tahsin
            </Link>
          </div>
        </>
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
