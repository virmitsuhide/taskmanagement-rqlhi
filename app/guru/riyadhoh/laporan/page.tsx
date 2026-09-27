import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import {
  getCapaianRiyadhoh, getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu,
  LABEL_CAPAIAN_RIYADHOH, type CapaianRiyadhoh, type StatusHadir,
} from '@/lib/data/riyadhoh'
import { LABEL_KELOMPOK } from '@/lib/rq/riyadhoh'
import { bintangDariNilai } from '@/lib/rq/bintang'
import { sapaanName } from '@/lib/auth/permissions'
import { PilihSabtu } from '@/components/riyadhoh/PilihSabtu'
import { SalinLaporan } from '@/components/riyadhoh/SalinLaporan'
import { cn } from '@/lib/utils'

/** Keterangan satu anak di laporan — satu kata yang langsung terbaca. */
type Keterangan = 'setor' | 'tidak_setor' | 'izin' | 'sakit' | 'alfa' | 'belum'

const LABEL_KET: Record<Exclude<Keterangan, 'setor'>, string> = {
  tidak_setor: 'Tidak setor', izin: 'Izin', sakit: 'Sakit', alfa: 'Alfa', belum: 'Kehadiran belum dicatat',
}
const WARNA_KET: Record<Exclude<Keterangan, 'setor'>, string> = {
  tidak_setor: 'bg-muted text-muted-foreground',
  izin: 'bg-info/15 text-info',
  sakit: 'bg-warning/15 text-warning',
  alfa: 'bg-destructive/15 text-destructive',
  belum: 'bg-muted text-muted-foreground',
}
const WARNA_JENIS: Record<CapaianRiyadhoh['jenis'], string> = {
  ziyadah: 'bg-primary-wash text-primary',
  murojaah_baru: 'bg-accent-warm-wash text-accent-warm',
  murojaah_lama: 'bg-accent-warm-wash text-accent-warm',
  murojaah: 'bg-accent-warm-wash text-accent-warm',
  tasmi: 'bg-primary-wash text-primary',
  tahsin: 'bg-muted text-foreground',
}

const bintang = (n: number | null) => {
  if (n === null) return ''
  const b = bintangDariNilai(n)
  return b ? `${'★'.repeat(Math.floor(b))}${b % 1 ? '½' : ''}` : ''
}

/**
 * Laporan Riyadhoh — langkah terakhir sesudah kehadiran & setoran: capaian
 * tiap anak kelompok pengampu pada Sabtu itu, dengan keterangan ziyadah /
 * muroja'ah baru / muroja'ah lama / tidak setor / izin / sakit / alfa, dan
 * teks siap tempel ke grup WhatsApp.
 */
export default async function LaporanRiyadhohPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { tanggal: diminta } = await searchParams
  const sabtu = await getSabtuPengampu(session.teacherId, diminta)
  if (!sabtu.terpilih) redirect('/guru/riyadhoh')
  const { tanggal, kelompok } = sabtu.terpilih

  const [peserta, hadir, guruRes] = await Promise.all([
    getPesertaKelompok(kelompok, session.teacherId),
    getHadirRiyadhoh(tanggal),
    createServerClient().from('teachers').select('sapaan, nickname, full_name').eq('id', session.teacherId).maybeSingle(),
  ])
  const capaian = await getCapaianRiyadhoh(tanggal, peserta.map(p => p.id))
  const guru = guruRes.data as { sapaan: string | null; nickname: string | null; full_name: string } | null
  const namaGuru = guru ? sapaanName(guru.sapaan, guru.nickname, guru.full_name) : session.fullName
  const tanggalTeks = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const baris = peserta.map(p => {
    const c = capaian.get(p.id) ?? []
    const h: StatusHadir | undefined = hadir[p.id]
    const ket: Keterangan = h === 'izin' || h === 'sakit' || h === 'alfa' ? h : c.length ? 'setor' : h === 'hadir' ? 'tidak_setor' : 'belum'
    return { id: p.id, nama: p.full_name, kelas: p.kelas, capaian: c, ket }
  })

  const hitung = (k: Keterangan) => baris.filter(b => b.ket === k).length
  const jumlahJenis = (j: CapaianRiyadhoh['jenis'][]) => baris.filter(b => b.capaian.some(c => j.includes(c.jenis))).length
  const ringkas = [
    { l: 'Hadir', n: baris.filter(b => hadir[b.id] === 'hadir' || b.ket === 'setor').length, dari: baris.length },
    { l: 'Ziyadah', n: jumlahJenis(['ziyadah']) },
    { l: "Muroja'ah", n: jumlahJenis(['murojaah_baru', 'murojaah_lama', 'murojaah']) },
    { l: 'Tahsin', n: jumlahJenis(['tahsin']) },
    { l: 'Tidak setor', n: hitung('tidak_setor') },
    { l: 'Izin', n: hitung('izin') },
    { l: 'Sakit', n: hitung('sakit') },
    { l: 'Alfa', n: hitung('alfa') },
  ].filter(x => x.n > 0 || x.l === 'Hadir')

  // Teks WhatsApp — sejalan dengan format laporan yang biasa dikirim pengampu.
  const teks = [
    `*Capaian Riyadhoh Qur'an ${LABEL_KELOMPOK[kelompok]}*`,
    `Kelompok ${namaGuru}`,
    `🗓️ ${tanggalTeks}`,
    '',
    ...baris.map((b, i) => {
      const kepala = `${i + 1}. ${b.nama}${b.kelas ? ` (${b.kelas})` : ''}`
      if (b.ket !== 'setor') return `${kepala}: ${LABEL_KET[b.ket]}`
      return `${kepala}:\n${b.capaian.map(c => `   • ${LABEL_CAPAIAN_RIYADHOH[c.jenis]}: ${c.teks}${c.ulang ? ' (ulang)' : ''}${c.nilai !== null ? ` ${bintang(c.nilai)}` : ''}`).join('\n')}`
    }),
    '',
    ringkas.map(x => `${x.l} ${x.n}${'dari' in x && x.dari ? `/${x.dari}` : ''}`).join(' · '),
  ].join('\n')

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
        <div>
          <Link href={`/guru/riyadhoh?tanggal=${tanggal}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ChevronLeft className="size-4" /> Riyadhoh
          </Link>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-warning">Langkah 3 · Laporan</p>
          <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            Laporan Riyadhoh {LABEL_KELOMPOK[kelompok]}
          </h1>
          <p className="text-sm text-muted-foreground">{tanggalTeks} · Kelompok {namaGuru}</p>
        </div>

        <PilihSabtu daftar={sabtu.daftar} terpilih={tanggal} hariIni={sabtu.hariIni} basePath="/guru/riyadhoh/laporan" />

        {baris.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Belum ada anak di kelompok Riyadhoh Anda.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {ringkas.map(x => (
                <span key={x.l} className="rounded-full border bg-card px-3 py-1 text-xs">
                  {x.l} <b className="tabular-nums">{x.n}{'dari' in x && x.dari ? `/${x.dari}` : ''}</b>
                </span>
              ))}
            </div>

            <ol className="divide-y rounded-2xl border bg-card">
              {baris.map((b, i) => (
                <li key={b.id} className="flex gap-3 px-4 py-3">
                  <span className="w-5 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="text-sm font-semibold">{b.nama} <span className="font-normal text-muted-foreground">{b.kelas ?? ''}</span></p>
                      {b.ket !== 'setor' && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', WARNA_KET[b.ket])}>{LABEL_KET[b.ket]}</span>
                      )}
                    </div>
                    {b.capaian.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {b.capaian.map((c, j) => (
                          <li key={j} className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', WARNA_JENIS[c.jenis])}>{LABEL_CAPAIAN_RIYADHOH[c.jenis]}</span>
                            <span>{c.teks}</span>
                            {c.ulang && <span className="text-xs text-destructive">ulang</span>}
                            {c.nilai !== null && <span className="text-xs text-warning">{bintang(c.nilai)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {hitung('belum') > 0 && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {hitung('belum')} anak belum dicatat kehadirannya.{' '}
                <Link href={`/guru/riyadhoh?tanggal=${tanggal}`} className="font-semibold underline">Isi kehadiran</Link>
              </p>
            )}

            <div className="sticky bottom-0 flex justify-end rounded-2xl border bg-card/95 p-3 backdrop-blur">
              <SalinLaporan teks={teks} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
