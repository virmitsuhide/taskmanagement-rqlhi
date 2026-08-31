'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canDecideKpiBanding } from '@/lib/auth/permissions'
import {
  bolehBanding, bolehEskalasi, lewatTenggat,
  tambahHariKerja, tanggalSql, MASA_PUTUSAN_HARI_KERJA,
} from '@/lib/kpi/alur'
import { catatRiwayat } from '@/lib/data/kpi-pengesahan'
import { nilaiDari } from '@/lib/data/kpi'
import { KPI_INDIKATOR } from '@/lib/kpi/hitung'
import type { KpiBanding, KpiBandingItem, KpiBandingStatus, KpiMonthly, KpiRaporStatus } from '@/types'

/**
 * Pengajuan, putusan, dan eskalasi banding rapor KPI.
 *
 * Alur lengkapnya:
 *
 *   guru ajukan (tingkat 1) ──> SDM memutus
 *        ├─ diterima         ──> rapor kembali ke draft, versi+1, SDM perbaiki
 *        ├─ diterima sebagian├─> guru boleh naik ke Kepala RQ (tingkat 2)
 *        └─ ditolak          ┘
 *   Kepala RQ memutus (tingkat 2) ──> final, apa pun hasilnya
 */

type Hasil = { error: string } | { success: true }

interface BarisRapor {
  id: string
  teacher_id: string
  unit: string | null
  year: number
  month: number
  status: KpiRaporStatus
  versi: number
  guru_ttd_at: string | null
  banding_batas: string | null
}

function segarkan(r: { year: number; month: number }) {
  revalidatePath('/kpi')
  revalidatePath('/kpi/banding')
  revalidatePath('/kpi/publikasi')
  revalidatePath('/guru/rapor-kpi')
  revalidatePath(`/guru/rapor-kpi/${r.year}/${r.month}`)
}

// ── Guru mengajukan ────────────────────────────────────────────────

/**
 * Baca butir-butir sanggahan dari formulir.
 *
 * Medannya berulang: `item_indikator`, `item_nilai`, `item_alasan`. getAll()
 * menjaga urutannya, jadi indeks ke-i dari ketiganya membentuk satu butir —
 * pola yang sama dengan collectRows() di profil.
 *
 * Butir tanpa alasan DIBUANG, bukan disimpan kosong. Sanggahan tanpa alasan
 * tidak bisa diperiksa siapa pun; menyimpannya hanya menambah pekerjaan
 * pemutus yang berujung pada penolakan yang sudah bisa ditebak sejak awal.
 */
function bacaButir(fd: FormData, entry: KpiMonthly): KpiBandingItem[] {
  const nilai = nilaiDari(entry).nilai
  const indikator = fd.getAll('item_indikator')
  const diklaim = fd.getAll('item_nilai')
  const alasan = fd.getAll('item_alasan')

  const out: KpiBandingItem[] = []
  for (let i = 0; i < indikator.length; i++) {
    const idx = Number(indikator[i])
    const teks = String(alasan[i] ?? '').trim()
    if (!Number.isInteger(idx) || idx < 0 || idx >= KPI_INDIKATOR.length) continue
    if (!teks) continue

    const klaim = Number(String(diklaim[i] ?? '').replace(',', '.'))
    out.push({
      indikator: idx,
      // Nilai tercatat DISALIN dari rapor, tidak diambil dari formulir. Kalau
      // ia datang dari peramban, sanggahan bisa dibuat seolah menyanggah angka
      // yang tidak pernah tercetak di rapor mana pun.
      nilaiTercatat: nilai[idx] ?? 0,
      nilaiDiklaim: Number.isFinite(klaim) ? Math.max(0, Math.min(100, klaim)) : 0,
      alasan: teks.slice(0, 1000),
    })
  }
  return out
}

/**
 * Guru mengajukan banding atas rapor bulanannya.
 *
 * Tiga syarat diperiksa ulang di sini meski tombolnya sudah disembunyikan di
 * halaman: rapor harus berstatus terbit, belum ditandatangani, dan tenggatnya
 * belum lewat. Halaman yang terbuka sejak kemarin akan menampilkan tombol yang
 * hari ini sudah tidak berlaku.
 */
export async function ajukanBandingAction(_: unknown, formData: FormData): Promise<Hasil> {
  const guru = await getTeacherSession()
  if (!guru) return { error: 'Sesi tidak valid.' }

  const kpiId = String(formData.get('kpi_id') ?? '')
  if (!kpiId) return { error: 'Rapor tidak dikenali.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select('*').eq('id', kpiId).maybeSingle()
  if (!data) return { error: 'Rapor tidak ditemukan.' }

  const entry = data as unknown as KpiMonthly
  const row: BarisRapor = entry as unknown as BarisRapor
  if (row.teacher_id !== guru.teacherId) return { error: 'Bukan rapor Anda.' }

  if (!bolehBanding(row.status, Boolean(row.guru_ttd_at), row.banding_batas)) {
    return {
      error: lewatTenggat(row.banding_batas)
        ? 'Masa banding rapor ini sudah berakhir.'
        : 'Rapor ini tidak bisa dibandingkan sekarang.',
    }
  }

  const items = bacaButir(formData, entry)
  if (items.length === 0) {
    return { error: 'Pilih minimal satu indikator dan tuliskan alasannya.' }
  }

  const { error } = await supabase.from('kpi_banding').insert({
    kpi_monthly_id: kpiId,
    teacher_id: guru.teacherId,
    versi_rapor: row.versi,
    tingkat: 1,
    items,
    putusan_batas: tanggalSql(tambahHariKerja(new Date(), MASA_PUTUSAN_HARI_KERJA)),
  })

  if (error) {
    // Indeks uniknya yang menolak: satu banding per (rapor, versi, tingkat).
    if (error.message?.includes('kpi_banding_sekali_per_versi')) {
      return { error: 'Anda sudah pernah mengajukan banding atas rapor ini.' }
    }
    if (error.message?.includes('kpi_banding')) {
      return { error: 'Fitur banding belum aktif: jalankan drizzle/0050_rapor_kpi_pengesahan_PASTE_TO_SUPABASE.sql di Supabase.' }
    }
    return { error: 'Gagal mengirim banding.' }
  }

  // Rapor ikut berpindah status supaya ia terkunci dari pematangan tenggat:
  // rapor yang sedang disengketakan tidak boleh diam-diam menjadi "final
  // tanpa tanda tangan" hanya karena tujuh hari kerjanya lewat sementara
  // perkaranya masih ditimbang.
  await supabase.from('kpi_monthly').update({ status: 'banding' }).eq('id', kpiId)

  await catatRiwayat({
    kpiId,
    versi: row.versi,
    aksi: 'banding_diajukan',
    teacherId: guru.teacherId,
    catatan: ringkasButir(items),
  })

  segarkan(row)
  return { success: true }
}

// ── Pemutus ────────────────────────────────────────────────────────

const PUTUSAN_SAH: KpiBandingStatus[] = ['diterima', 'diterima_sebagian', 'ditolak']

/**
 * Putuskan sebuah banding.
 *
 * Alasan wajib untuk ketiga hasil, termasuk "diterima" — bukan hanya untuk
 * penolakan. Yang menerima pun perlu menuliskan apa yang ia temukan, sebab
 * itulah yang dibaca SDM saat memperbaiki angkanya dan yang dibaca koordinator
 * saat menandatangani versi berikutnya.
 *
 * Banding yang DITERIMA (penuh maupun sebagian) mengembalikan rapor ke draft
 * dengan versi baru. Nilainya tidak diubah di sini: yang memutus belum tentu
 * yang memegang bahan mentahnya, dan menebak angka baru di dalam putusan akan
 * melewati satu-satunya tempat yang punya rubrik lengkap — formulir KPI.
 */
export async function putusBandingAction(_: unknown, formData: FormData): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const bandingId = String(formData.get('banding_id') ?? '')
  const putusan = String(formData.get('putusan') ?? '') as KpiBandingStatus
  const alasan = String(formData.get('alasan') ?? '').trim()

  if (!bandingId) return { error: 'Banding tidak dikenali.' }
  if (!PUTUSAN_SAH.includes(putusan)) return { error: 'Putusan tidak sah.' }
  if (alasan.length < 10) return { error: 'Tuliskan alasan putusan, minimal 10 karakter.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_banding').select('*').eq('id', bandingId).maybeSingle()
  const b = data as KpiBanding | null
  if (!b) return { error: 'Banding tidak ditemukan.' }
  if (b.status !== 'diajukan') return { error: 'Banding ini sudah diputus.' }
  if (!canDecideKpiBanding(session.role, b.tingkat)) {
    return {
      error: b.tingkat === 1
        ? 'Banding tingkat 1 diputus SDM.'
        : 'Banding tingkat 2 diputus Kepala RQ.',
    }
  }

  const { data: raporData } = await supabase
    .from('kpi_monthly')
    .select('id, teacher_id, unit, year, month, status, versi, guru_ttd_at, banding_batas')
    .eq('id', b.kpi_monthly_id)
    .maybeSingle()
  const rapor = raporData as BarisRapor | null
  if (!rapor) return { error: 'Rapor tidak ditemukan.' }

  const { error } = await supabase
    .from('kpi_banding')
    .update({
      status: putusan,
      putusan_oleh: session.userId,
      putusan_at: new Date().toISOString(),
      putusan_alasan: alasan,
    })
    .eq('id', bandingId)

  if (error) return { error: 'Gagal menyimpan putusan.' }

  await terapkanPutusan({ rapor, tingkat: b.tingkat, putusan, userId: session.userId })

  await catatRiwayat({
    kpiId: rapor.id,
    versi: rapor.versi,
    aksi: 'banding_diputus',
    userId: session.userId,
    catatan: `Tingkat ${b.tingkat} — ${putusan}. ${alasan}`,
  })

  segarkan(rapor)
  return { success: true }
}

/**
 * Ke mana rapor bergerak setelah bandingnya diputus.
 *
 * Diterima (penuh/sebagian) → kembali ke draft dengan versi baru. Tanda tangan
 * koordinator digugurkan: ia menandatangani angka yang sebentar lagi berubah,
 * dan tanda tangan yang bertahan melewati perubahan angka adalah tepat hal
 * yang membuat tanda tangan tidak bernilai. Guru pun menandatangani ulang
 * nanti — rapor revisi adalah dokumen lain.
 *
 * Ditolak di tingkat 1 → rapor kembali ke 'terbit'. Guru masih punya dua
 * pilihan: menerima, atau menaikkannya ke Kepala RQ. Tenggat bandingnya
 * diperpanjang dari hari putusan, sebab masa yang lama sudah habis terpakai
 * untuk menunggu jawaban yang bukan urusannya.
 *
 * Ditolak di tingkat 2 → 'selesai' dengan sebab putusan_final. Tidak ada lagi
 * yang bisa disengketakan, dan rapor yang dibiarkan terbuka tanpa ujung akan
 * menggantung di daftar semua orang selamanya.
 */
async function terapkanPutusan(opts: {
  rapor: BarisRapor
  tingkat: number
  putusan: KpiBandingStatus
  userId: string
}): Promise<void> {
  const { rapor, tingkat, putusan, userId } = opts
  const supabase = createServerClient()

  if (putusan === 'diterima' || putusan === 'diterima_sebagian') {
    await supabase
      .from('kpi_monthly')
      .update({
        status: 'draft',
        selesai_sebab: null,
        versi: rapor.versi + 1,
        koor_ttd_path: null, koor_ttd_focus: null,
        guru_ttd_at: null, guru_ttd_path: null, guru_ttd_focus: null,
        guru_dibuka_at: null,
        terbit_at: null, terbit_by: null,
        banding_batas: null,
        dikembalikan_alasan: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rapor.id)
    return
  }

  if (tingkat === 1) {
    await supabase
      .from('kpi_monthly')
      .update({
        status: 'terbit',
        banding_batas: tanggalSql(tambahHariKerja(new Date(), MASA_PUTUSAN_HARI_KERJA)),
      })
      .eq('id', rapor.id)
    return
  }

  await supabase
    .from('kpi_monthly')
    .update({ status: 'selesai', selesai_sebab: 'putusan_final' })
    .eq('id', rapor.id)
}

// ── Eskalasi ke Kepala RQ ──────────────────────────────────────────

/**
 * Guru menaikkan bandingnya ke Kepala RQ.
 *
 * Yang naik adalah perkara yang sama, bukan perkara baru: butir-butirnya
 * disalin dari banding tingkat 1 dan tidak bisa diubah. Kalau guru boleh
 * menulis ulang sanggahannya di tingkat dua, tingkat satu berhenti menjadi
 * pemeriksaan dan berubah menjadi latihan.
 *
 * Hanya tersedia atas putusan 'ditolak' dan 'diterima_sebagian'. Yang diterima
 * penuh tidak menyisakan apa pun untuk disengketakan.
 */
export async function eskalasiBandingAction(_: unknown, formData: FormData): Promise<Hasil> {
  const guru = await getTeacherSession()
  if (!guru) return { error: 'Sesi tidak valid.' }

  const bandingId = String(formData.get('banding_id') ?? '')
  const alasan = String(formData.get('alasan') ?? '').trim()
  if (!bandingId) return { error: 'Banding tidak dikenali.' }
  if (alasan.length < 10) {
    return { error: 'Tuliskan keberatan Anda atas putusan tingkat 1, minimal 10 karakter.' }
  }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_banding').select('*').eq('id', bandingId).maybeSingle()
  const b = data as KpiBanding | null
  if (!b) return { error: 'Banding tidak ditemukan.' }
  if (b.teacher_id !== guru.teacherId) return { error: 'Bukan banding Anda.' }
  if (!bolehEskalasi(b)) return { error: 'Putusan ini tidak bisa dinaikkan ke tingkat 2.' }

  const { data: raporData } = await supabase
    .from('kpi_monthly')
    .select('id, teacher_id, unit, year, month, status, versi, guru_ttd_at, banding_batas')
    .eq('id', b.kpi_monthly_id)
    .maybeSingle()
  const rapor = raporData as BarisRapor | null
  if (!rapor) return { error: 'Rapor tidak ditemukan.' }
  if (rapor.guru_ttd_at) return { error: 'Rapor ini sudah Anda tandatangani.' }

  const { error } = await supabase.from('kpi_banding').insert({
    kpi_monthly_id: b.kpi_monthly_id,
    teacher_id: guru.teacherId,
    versi_rapor: b.versi_rapor,
    tingkat: 2,
    induk_id: b.id,
    items: b.items,
    eskalasi_alasan: alasan,
    putusan_batas: tanggalSql(tambahHariKerja(new Date(), MASA_PUTUSAN_HARI_KERJA)),
  })

  if (error) {
    if (error.message?.includes('kpi_banding_sekali_per_versi')) {
      return { error: 'Perkara ini sudah pernah dinaikkan ke Kepala RQ.' }
    }
    return { error: 'Gagal menaikkan banding.' }
  }

  await supabase.from('kpi_monthly').update({ status: 'banding' }).eq('id', rapor.id)

  await catatRiwayat({
    kpiId: rapor.id,
    versi: rapor.versi,
    aksi: 'banding_eskalasi',
    teacherId: guru.teacherId,
    catatan: alasan,
  })

  segarkan(rapor)
  return { success: true }
}

/** Ringkasan satu baris untuk catatan riwayat. */
function ringkasButir(items: KpiBandingItem[]): string {
  return items
    .map(i => `${KPI_INDIKATOR[i.indikator]}: ${i.nilaiTercatat} → ${i.nilaiDiklaim}`)
    .join('; ')
    .slice(0, 500)
}
