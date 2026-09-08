import Link from 'next/link'
import { BookOpen, ChevronRight, TriangleAlert } from 'lucide-react'
import { formatPeriod } from '@/lib/finance/period'
import type { RingkasanPembinaan as Data } from '@/lib/data/ringkasan-pembinaan'

/**
 * Capaian santri & kelengkapan catatannya — di dashboard, bukan di menu terpisah.
 *
 * Modul analitik RQ sudah lama menyimpan angka-angka ini, tapi ia berdiri
 * sebagai halaman tersendiri: hanya ditemukan oleh yang sudah tahu harus
 * mencarinya. Yang dibawa ke sini bukan seluruh analitik, melainkan dua kalimat
 * pertama saja — sampai mana anak-anak, dan apakah catatannya lengkap —
 * dengan tautan ke halaman penuhnya untuk yang ingin menelusuri.
 *
 * Kelengkapan sengaja berdampingan dengan capaian, bukan di bagian lain. Sebaran
 * capaian hanya bermakna sejauh datanya lengkap; menyebut "312 anak di
 * Al-Qur'an" tanpa menyebut bahwa separuh angkatan belum dinilai bulan ini
 * adalah cara membuat angka yang keliru terlihat resmi.
 */
export function RingkasanPembinaan({ data }: { data: Data }) {
  if (data.totalSiswa === 0) return null

  const { bulan } = data
  const perlu = bulan.percent < 80

  const golongan = [
    { label: 'Jilid', nilai: data.jilid, warna: 'text-foreground' },
    { label: 'Al-Qur’an', nilai: data.quran, warna: 'text-primary' },
    { label: 'Tahfidz', nilai: data.tahfidz, warna: 'text-success' },
    { label: 'Belum terdata', nilai: data.belumTerdata, warna: 'text-muted-foreground' },
  ]

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4" /> Capaian Santri
        </h2>
        <Link
          href="/dashboard/analitik/unit"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          Rincian per unit <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Empat golongan, bukan empat kartu bergaris. Angkanya yang jadi
          hierarki; bingkai pada tiap petak akan membuat keempatnya tampak
          setara padahal "belum terdata" bukan capaian. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {golongan.map(g => (
          <div key={g.label}>
            <p className={`text-2xl font-bold tabular-nums leading-none ${g.warna}`}>{g.nilai}</p>
            <p className="mt-1 text-xs text-muted-foreground">{g.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {data.totalSiswa} santri aktif dalam cakupan Anda.
      </p>

      {/* ── Kelengkapan bulan berjalan ───────────────────────────── */}
      <div className="mt-5 border-t pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-xs font-semibold">
            Dinilai {formatPeriod(bulan.period)}
          </h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className={`font-semibold ${perlu ? 'text-warning' : 'text-success'}`}>
              {bulan.dinilai}
            </span>
            {' '}dari {bulan.total} santri · {bulan.percent}%
          </p>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${perlu ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${Math.min(100, bulan.percent)}%` }}
          />
        </div>

        {/* Halaqoh yang KOSONG SAMA SEKALI disebut terpisah dari persentase.
            Sepuluh halaqoh terisi separuh dan lima halaqoh tak tersentuh bisa
            menghasilkan persentase yang sama, tapi menuntut tindakan yang
            berbeda: yang satu mengingatkan, yang lain mencari tahu sebabnya. */}
        {bulan.halaqohKosong > 0 ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {bulan.halaqohKosong} dari {bulan.totalHalaqoh} halaqoh belum
              dinilai sama sekali bulan ini.{' '}
              <Link href="/dashboard/analitik/kelengkapan" className="font-medium underline">
                Lihat daftarnya
              </Link>
            </span>
          </p>
        ) : (
          <p className="mt-2.5 text-xs text-muted-foreground">
            Seluruh {bulan.totalHalaqoh} halaqoh sudah mulai dinilai bulan ini.
          </p>
        )}
      </div>
    </section>
  )
}
