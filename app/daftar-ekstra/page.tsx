import type { Metadata } from 'next'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { FormBookingEkstra, type JenisPublik, type GuruPublik } from '@/components/ekstra/FormBookingEkstra'
import { bolehGuruEkstra, getDataEkstra, getGuruEkstra, keJenisPublik } from '@/lib/data/ekstra'
import { getPublicTeachers } from '@/lib/data/site'

export const metadata: Metadata = {
  title: "Daftar Ekstra Tahsin & Tahfidz — Rumah Qur'an LHI",
  description: "Pesan jadwal ekstra tahsin atau tahfidz bersama pengajar Rumah Qur'an LHI.",
}

// Jenis & guru bisa berubah kapan saja — jangan disajikan dari cache lama.
export const dynamic = 'force-dynamic'

export default async function DaftarEkstraPage({ searchParams }: { searchParams: Promise<{ jenis?: string; guru?: string }> }) {
  const sp = await searchParams
  const [data, pengajar, { ids: guruEkstra }] = await Promise.all([getDataEkstra({ hanyaAktif: true }), getPublicTeachers(), getGuruEkstra()])

  // Semua guru terbuka untuk ekstra: orang tua memilih jenis & waktu, guru
  // pilihan hanya preferensi. Tidak ada jadwal atau data peserta di sini.
  const jenis: JenisPublik[] = data.jenis.map(keJenisPublik)
  // Hanya guru yang bersedia mengampu ekstra (daftar Koordinator Ekstra).
  const guru: GuruPublik[] = pengajar.filter(t => bolehGuruEkstra(guruEkstra, t.id)).map(t => ({ id: t.id, nama: t.full_name }))

  // Kerangka mengikuti beranda (app/page.tsx): kontainer max-w-6xl px-4 sm:px-6,
  // hero pt-10/md:pt-14, judul seksi 30/40px, jarak antar-seksi pb-16.
  return (
    <div className="min-h-screen bg-background" style={{ fontSize: 14, lineHeight: 1.5 }}>
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-7 pt-10 sm:px-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:pb-9 md:pt-14">
        <div className="min-w-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Ekstra tahsin &amp; tahfidz</p>
          <h1 className="m-0 font-heading text-[clamp(34px,6vw,60px)] font-normal leading-[1.05] tracking-[-0.02em]">
            Pendampingan tambahan, <span className="italic text-primary">bersama pengajar kami.</span>
          </h1>
        </div>
        <ol className="min-w-0 space-y-2 rounded-2xl border bg-card p-5 text-sm leading-relaxed">
          <li><b className="text-accent-warm">1.</b> <b>Ajukan</b> — pilih jenis ekstra, waktu yang diinginkan, dan guru pilihan bila ada.</li>
          <li><b className="text-accent-warm">2.</b> <b>Dicarikan guru</b> — Koordinator Ekstra memastikan guru yang bisa pada waktu itu, lalu menghubungi Anda lewat WhatsApp.</li>
          <li><b className="text-accent-warm">3.</b> <b>Mulai belajar</b> — capaian anak LHI ikut tercatat di aplikasi dan dilaporkan tersendiri.</li>
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <h2 className="mb-6 font-heading text-[30px] font-normal leading-tight tracking-[-0.015em] md:text-[40px]">
          Formulir pendaftaran
        </h2>
        <div className="max-w-4xl">
          {!data.tabelAda || jenis.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">
              Pendaftaran ekstra belum dibuka. Silakan kembali lagi nanti.
            </p>
          ) : (
            <FormBookingEkstra jenis={jenis} guru={guru} awal={{ jenis: sp.jenis, guru: sp.guru }} />
          )}
        </div>
      </section>
      <PublicFooter />
    </div>
  )
}
