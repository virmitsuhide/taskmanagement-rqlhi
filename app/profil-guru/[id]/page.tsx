import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getPublicTeachers } from '@/lib/data/site'
import { bolehGuruEkstra, getDataEkstra, getGuruEkstra, keJenisPublik } from '@/lib/data/ekstra'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { FormBookingEkstra, type JenisPublik, type GuruPublik } from '@/components/ekstra/FormBookingEkstra'

/**
 * Profil publik satu guru + booking ekstra bersamanya.
 *
 * Hanya guru yang ditandai tampil publik oleh Humas yang punya halaman ini;
 * isinya terbatas pada yang memang disiapkan untuk publik (foto, jabatan,
 * bio). Semua guru terbuka untuk ekstra: formulir di sini sudah memilih guru
 * ini sebagai preferensi; Koordinator Ekstra yang memastikan jadwalnya.
 */

export const dynamic = 'force-dynamic'

async function ambilGuru(id: string) {
  const semua = await getPublicTeachers()
  return { guru: semua.find(t => t.id === id) ?? null, semua }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { guru } = await ambilGuru((await params).id)
  return guru
    ? { title: `${guru.full_name} — Rumah Qur'an LHI`, description: guru.keterangan }
    : { title: "Profil Guru — Rumah Qur'an LHI" }
}

const LANGKAH = [
  { t: 'Ajukan keinginan', d: 'Pilih jenis ekstra dan waktu yang diinginkan, lalu isi data peserta — siswa LHI atau bukan — dan nomor WhatsApp.' },
  { t: 'Dicarikan guru', d: 'Koordinator Ekstra memastikan guru pilihan Anda bisa pada waktu itu — bila tidak, menawarkan guru lain lewat WhatsApp.' },
  { t: 'Mulai belajar', d: 'Capaian ekstra anak LHI tercatat di aplikasi dan dilaporkan tersendiri kepada orang tua.' },
]

export default async function GuruDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ guru, semua }, ekstra, { ids: guruEkstra }] = await Promise.all([ambilGuru(id), getDataEkstra({ hanyaAktif: true }), getGuruEkstra()])
  if (!guru) notFound()

  const jenis: JenisPublik[] = ekstra.jenis.map(keJenisPublik)
  const daftarGuru: GuruPublik[] = semua.filter(t => bolehGuruEkstra(guruEkstra, t.id)).map(t => ({ id: t.id, nama: t.full_name }))
  // Guru yang tidak ada di daftar guru ekstra tidak bisa dibooking.
  const menerima = bolehGuruEkstra(guruEkstra, guru.id)
  const bukaEkstra = ekstra.tabelAda && jenis.length > 0 && menerima
  const inisial = guru.full_name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  const sapaan = guru.full_name.split(/\s+/).slice(0, 2).join(' ')

  return (
    <div className="min-h-screen bg-background" style={{ fontSize: 14, lineHeight: 1.5 }}>
      <PublicHeader />

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <nav aria-label="Jejak" className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
          <Link href="/profil-guru" className="hover:text-foreground">Profil guru</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words font-semibold text-foreground">{guru.full_name}</span>
        </nav>
      </div>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid min-w-0 items-end gap-6 sm:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
          <div className="aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-2xl border bg-primary-wash">
            {guru.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guru.photo_url} alt={guru.full_name} className="h-full w-full" style={photoStyle(parseFocus(guru.photo_focus))} />
            ) : (
              <span className="flex h-full items-center justify-center font-heading text-6xl text-primary">{inisial}</span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">{guru.keterangan}</p>
            <h1 className="mt-2 break-words font-heading text-[clamp(34px,6vw,60px)] font-normal leading-[1.05] tracking-[-0.02em]">{guru.full_name}</h1>
          </div>
          {guru.public_bio && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tentang</p>
              <p className="mt-2 whitespace-pre-line font-heading text-xl leading-relaxed md:text-[22px]">{guru.public_bio}</p>
            </div>
          )}
        </div>

        {/* Ajakan booking — berlaku untuk semua guru. */}
        <aside className="min-w-0 rounded-2xl border bg-card p-5 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Booking ekstra</p>
          <h2 className="mt-1 font-heading text-2xl leading-tight">Belajar tambahan bersama {sapaan}</h2>
          {bukaEkstra ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Pilih jenis ekstra dan waktu yang Anda inginkan. Koordinator Ekstra memastikan jadwal {sapaan} — bila berhalangan, Anda ditawari guru lain.
              </p>
              <ul className="mt-4 divide-y rounded-xl border">
                {jenis.slice(0, 5).map(j => (
                  <li key={j.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{j.nama}</span>
                    <span className="shrink-0 text-xs font-semibold text-accent-warm">{j.biaya}</span>
                  </li>
                ))}
              </ul>
              {jenis.length > 5 && <p className="mt-2 text-xs text-muted-foreground">+{jenis.length - 5} jenis lain di formulir.</p>}
              <a href="#booking" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-accent-warm px-4 py-2.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90">
                Booking {sapaan}
              </a>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {!menerima && ekstra.tabelAda && jenis.length > 0
                ? <>{sapaan} sedang tidak menerima ekstra. Pilih guru lain di <Link href="/daftar-ekstra" className="font-semibold text-primary hover:underline">halaman ekstra</Link>.</>
                : 'Pendaftaran ekstra belum dibuka. Silakan kembali lagi nanti.'}
            </p>
          )}
        </aside>
      </section>

      {bukaEkstra && (
        <section id="booking" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Formulir booking</p>
          <h2 className="mb-6 mt-2 font-heading text-[30px] font-normal leading-tight tracking-[-0.015em] md:text-[40px]">Ajukan ekstra bersama {sapaan}</h2>
          <div className="max-w-4xl"><FormBookingEkstra jenis={jenis} guru={daftarGuru} awal={{ guru: guru.id }} /></div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Cara kerja ekstra</p>
        <h2 className="mt-2 font-heading text-[30px] font-normal leading-tight tracking-[-0.015em] md:text-[40px]">Tiga langkah, dikonfirmasi manusia</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {LANGKAH.map((l, i) => (
            <div key={l.t} className="rounded-2xl border bg-card p-5">
              <span className="font-heading text-4xl leading-none text-accent-warm">{i + 1}</span>
              <p className="mt-3 font-bold">{l.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{l.d}</p>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
