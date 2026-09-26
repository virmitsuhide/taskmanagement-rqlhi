import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { getPublicTeachers } from '@/lib/data/site'
import { getDataEkstra, labelSlot, rupiah } from '@/lib/data/ekstra'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { FormBookingEkstra, type JenisPublik, type SlotPublik } from '@/components/ekstra/FormBookingEkstra'

/**
 * Profil publik satu guru + booking ekstra bersamanya.
 *
 * Hanya guru yang ditandai tampil publik oleh Humas yang punya halaman ini;
 * isinya terbatas pada yang memang disiapkan untuk publik (foto, jabatan,
 * bio) dan jadwal ekstra yang dibuka Koordinator Ekstra.
 */

export const dynamic = 'force-dynamic'

async function ambilGuru(id: string) {
  const semua = await getPublicTeachers()
  return semua.find(t => t.id === id) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const guru = await ambilGuru((await params).id)
  return guru
    ? { title: `${guru.full_name} — Rumah Qur'an LHI`, description: guru.public_title ?? "Pengajar Rumah Qur'an LHI" }
    : { title: "Profil Guru — Rumah Qur'an LHI" }
}

const LANGKAH = [
  { t: 'Ajukan jadwal', d: 'Pilih jenis ekstra dan slot pekanan, lalu isi data anak dan nomor WhatsApp orang tua.' },
  { t: 'Dikonfirmasi koordinator', d: 'Koordinator Ekstra memeriksa kuota, lalu mengonfirmasi atau menawarkan jadwal lain lewat WhatsApp.' },
  { t: 'Mulai belajar', d: 'Capaian ekstra anak LHI tercatat di aplikasi dan dilaporkan tersendiri kepada orang tua.' },
]

export default async function GuruDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [guru, ekstra] = await Promise.all([ambilGuru(id), getDataEkstra({ hanyaAktif: true })])
  if (!guru) notFound()

  const slotGuru = ekstra.slot.filter(s => s.teacher_id === guru.id)
  const jenisGuru = ekstra.jenis.filter(j => slotGuru.some(s => s.jenis_id === j.id))
  const jenis: JenisPublik[] = jenisGuru.map(j => ({
    id: j.id, nama: j.nama, bidang: j.bidang, deskripsi: j.deskripsi,
    biaya: `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}`,
    waktu: [`${j.durasi_menit} menit`, j.keterangan_waktu, `maks. ${j.kuota} peserta`].filter(Boolean).join(' · '),
  }))
  const slot: SlotPublik[] = slotGuru.map(s => ({
    id: s.id, jenis_id: s.jenis_id, guru: s.guru ?? guru.full_name, teacher_id: s.teacher_id,
    label: labelSlot(s), tempat: s.tempat, sisa: Math.max(0, s.kuotaEfektif - s.peserta),
  }))
  const sisa = slot.reduce((n, s) => n + s.sisa, 0)
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
            {guru.public_title && <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">{guru.public_title}</p>}
            <h1 className="mt-2 break-words font-heading text-[clamp(34px,6vw,60px)] font-normal leading-[1.05] tracking-[-0.02em]">{guru.full_name}</h1>
            {slot.length > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-warm-wash px-2.5 py-1 text-xs font-bold text-accent-warm">
                <CalendarClock className="h-3.5 w-3.5" />Menerima ekstra
              </p>
            )}
          </div>
          {guru.public_bio && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tentang</p>
              <p className="mt-2 whitespace-pre-line font-heading text-xl leading-relaxed md:text-[22px]">{guru.public_bio}</p>
            </div>
          )}
        </div>

        {/* Ringkasan jadwal ekstra */}
        <aside className="min-w-0 rounded-2xl border bg-card p-5 md:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Booking ekstra</p>
          <h2 className="mt-1 font-heading text-2xl leading-tight">Belajar tambahan bersama {sapaan}</h2>
          {slot.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Saat ini belum ada jadwal ekstra yang dibuka. Lihat guru lain di{' '}
              <Link href="/daftar-ekstra" className="font-semibold text-primary hover:underline">halaman ekstra</Link>.
            </p>
          ) : (
            <>
              <ul className="mt-4 divide-y rounded-xl border">
                {slot.map(s => (
                  <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {jenis.find(j => j.id === s.jenis_id)?.nama}{s.tempat ? ` · ${s.tempat}` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[11px] font-semibold ${s.sisa > 0 ? 'text-success' : 'text-accent-warm'}`}>
                      {s.sisa > 0 ? `${s.sisa} kursi` : 'Penuh'}
                    </span>
                  </li>
                ))}
              </ul>
              <a href="#booking" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-accent-warm px-4 py-2.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90">
                {sisa > 0 ? 'Pesan jadwal' : 'Daftar — koordinator tawarkan jadwal lain'}
              </a>
            </>
          )}
        </aside>
      </section>

      {slot.length > 0 && (
        <section id="booking" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Formulir booking</p>
          <h2 className="mb-6 mt-2 font-heading text-[30px] font-normal leading-tight tracking-[-0.015em] md:text-[40px]">Ajukan jadwal ekstra</h2>
          <div className="max-w-4xl"><FormBookingEkstra jenis={jenis} slot={slot} awal={{ guru: guru.id }} kunciGuru /></div>
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
