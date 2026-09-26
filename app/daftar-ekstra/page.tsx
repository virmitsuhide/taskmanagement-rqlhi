import type { Metadata } from 'next'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { FormBookingEkstra, type JenisPublik, type SlotPublik } from '@/components/ekstra/FormBookingEkstra'
import { getDataEkstra, labelSlot, rupiah } from '@/lib/data/ekstra'

export const metadata: Metadata = {
  title: "Daftar Ekstra Tahsin & Tahfidz — Rumah Qur'an LHI",
  description: "Pesan jadwal ekstra tahsin atau tahfidz bersama pengajar Rumah Qur'an LHI.",
}

// Kuota berubah setiap ada peserta diterima — jangan disajikan dari cache lama.
export const dynamic = 'force-dynamic'

export default async function DaftarEkstraPage({ searchParams }: { searchParams: Promise<{ jenis?: string; slot?: string; guru?: string }> }) {
  const sp = await searchParams
  const data = await getDataEkstra({ hanyaAktif: true })

  // Hanya yang boleh tampil ke publik: nama guru, jadwal, sisa kursi — tanpa data peserta.
  const jenis: JenisPublik[] = data.jenis
    .filter(j => data.slot.some(s => s.jenis_id === j.id))
    .map(j => ({
      id: j.id, nama: j.nama, bidang: j.bidang, deskripsi: j.deskripsi,
      biaya: `${rupiah(j.biaya)}${j.biaya ? ` ${j.satuan_biaya}` : ''}`,
      waktu: [`${j.durasi_menit} menit`, j.keterangan_waktu, `maks. ${j.kuota} peserta`].filter(Boolean).join(' · '),
    }))
  const slot: SlotPublik[] = data.slot.map(s => ({
    id: s.id, jenis_id: s.jenis_id, guru: s.guru ?? '—', teacher_id: s.teacher_id,
    label: labelSlot(s), tempat: s.tempat, sisa: Math.max(0, s.kuotaEfektif - s.peserta),
  }))

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
          <li><b className="text-accent-warm">1.</b> <b>Ajukan</b> — pilih jenis ekstra dan jadwal, isi data anak.</li>
          <li><b className="text-accent-warm">2.</b> <b>Dikonfirmasi</b> — Koordinator Ekstra memeriksa kuota lalu menghubungi Anda lewat WhatsApp.</li>
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
            <FormBookingEkstra jenis={jenis} slot={slot} awal={{ jenis: sp.jenis, slot: sp.slot, guru: sp.guru }} />
          )}
        </div>
      </section>
      <PublicFooter />
    </div>
  )
}
