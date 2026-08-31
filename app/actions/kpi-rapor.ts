'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  canInputKpi, canPublishKpiRapor, canResetKpiRapor,
} from '@/lib/auth/permissions'
import {
  bolehDiajukan, bolehDiterbitkan, bolehTtdGuru, terkunci,
  tambahHariKerja, tanggalSql, MASA_BANDING_HARI_KERJA,
} from '@/lib/kpi/alur'
import { catatRiwayat } from '@/lib/data/kpi-pengesahan'
import { parseTtdFocus } from '@/lib/kpi/tanda-tangan'
import type { Jenjang, KpiRaporStatus } from '@/types'

/**
 * Perpindahan status selembar rapor KPI: pengajuan, pengesahan, tanda tangan
 * guru, dan reset oleh Kepala RQ.
 *
 * Tiap action memeriksa dua hal terpisah — WEWENANG (siapa dia) dan KEADAAN
 * (rapornya sedang di status mana). Keduanya tidak boleh dilebur: seorang
 * koordinator memang berwenang menerbitkan, tapi tidak atas rapor yang sudah
 * terbit; dan pemeriksaan keadaan yang dilakukan di halaman saja akan
 * terlewati oleh dua tab yang terbuka bersamaan.
 */

/** Bentuk hasil yang sama untuk semua action di sini. */
type Hasil = { error: string } | { success: true; jumlah?: number }

interface BarisAlur {
  id: string
  teacher_id: string
  unit: Jenjang | null
  year: number
  month: number
  status: KpiRaporStatus
  versi: number
  guru_ttd_at: string | null
  banding_batas: string | null
}

const KOLOM =
  'id, teacher_id, unit, year, month, status, versi, guru_ttd_at, banding_batas'

function segarkan(unit: Jenjang | null, year: number, month: number) {
  revalidatePath('/kpi')
  revalidatePath('/kpi/publikasi')
  revalidatePath('/kpi/cetak')
  revalidatePath('/guru/rapor-kpi')
  if (unit) revalidatePath(`/kpi/publikasi?unit=${unit}&year=${year}&month=${month}`)
}

// ── SDM: menyerahkan rapor kepada koordinator ──────────────────────

/**
 * Ajukan satu atau beberapa rapor ke koordinator unitnya.
 *
 * Baris yang statusnya tidak layak diajukan DILEWATI, bukan membatalkan
 * seluruh permintaan. SDM memilih "ajukan semua" atas tiga puluh guru; kalau
 * satu di antaranya sudah terlanjur diajukan dari tab lain, membatalkan
 * semuanya berarti dua puluh sembilan yang benar ikut gagal tanpa sebab.
 */
export async function ajukanRaporAction(kpiIds: string[]): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canInputKpi(session.role)) return { error: 'Hanya SDM yang mengajukan rapor KPI.' }
  if (kpiIds.length === 0) return { error: 'Belum ada rapor yang dipilih.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select(KOLOM).in('id', kpiIds)
  const rows = (data ?? []) as BarisAlur[]
  const layak = rows.filter(r => bolehDiajukan(r.status))
  if (layak.length === 0) return { error: 'Tidak ada rapor yang bisa diajukan.' }

  const { error } = await supabase
    .from('kpi_monthly')
    .update({
      status: 'diajukan',
      diajukan_at: new Date().toISOString(),
      diajukan_by: session.userId,
      // Alasan pengembalian sebelumnya dihapus: ia menjawab "kenapa dulu
      // dikembalikan", dan setelah diperbaiki lalu diajukan lagi pertanyaan
      // itu sudah dijawab. Membiarkannya membuat koordinator membaca keberatan
      // yang mungkin sudah tidak berlaku.
      dikembalikan_alasan: null,
    })
    .in('id', layak.map(r => r.id))

  if (error) return { error: galatKolom(error.message) }

  await Promise.all(layak.map(r =>
    catatRiwayat({ kpiId: r.id, pemilikId: r.teacher_id, year: r.year, month: r.month, versi: r.versi, aksi: 'diajukan', userId: session.userId }),
  ))

  const c = layak[0]
  segarkan(c.unit, c.year, c.month)
  return { success: true, jumlah: layak.length }
}

// ── Koordinator: menandatangani & menerbitkan ──────────────────────

/**
 * Terbitkan rapor kepada guru, sekaligus membubuhkan tanda tangan koordinator.
 *
 * Gambar tanda tangannya DISALIN ke tiap baris rapor, bukan diacu dari profil.
 * Koordinator yang tahun depan mengganti gambar tanda tangannya tidak boleh
 * mengubah tanda tangan pada dokumen yang sudah diserahkan tahun ini.
 *
 * Tanpa gambar di profil, permintaannya ditolak. Ini satu-satunya syarat yang
 * dijadikan penghalang keras di alur ini: rapor terbit tanpa tanda tangan
 * adalah dokumen yang sudah sampai ke guru dalam keadaan tidak sah, dan
 * menariknya kembali jauh lebih mahal daripada mengunggah gambar lebih dulu.
 */
export async function terbitkanRaporAction(kpiIds: string[]): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (kpiIds.length === 0) return { error: 'Belum ada rapor yang dipilih.' }

  const supabase = createServerClient()

  const { data: profil } = await supabase
    .from('users')
    .select('signature_path, signature_focus')
    .eq('id', session.userId)
    .maybeSingle()

  const ttdPath = (profil as { signature_path: string | null } | null)?.signature_path ?? null
  if (!ttdPath) {
    return { error: 'Unggah gambar tanda tangan Anda di Profil Saya sebelum menerbitkan rapor.' }
  }

  const { data } = await supabase.from('kpi_monthly').select(KOLOM).in('id', kpiIds)
  const rows = (data ?? []) as BarisAlur[]

  // Wewenangnya diperiksa PER BARIS, bukan sekali di muka: satu permintaan
  // bisa memuat rapor dari unit yang bukan tanggung jawabnya, dan koordinator
  // hanya menandatangani kinerja orang yang ia pimpin langsung.
  const layak = rows.filter(r => bolehDiterbitkan(r.status) && canPublishKpiRapor(session.role, r.unit))
  if (layak.length === 0) return { error: 'Tidak ada rapor yang bisa Anda terbitkan.' }

  const kini = new Date()
  const { error } = await supabase
    .from('kpi_monthly')
    .update({
      status: 'terbit',
      terbit_at: kini.toISOString(),
      terbit_by: session.userId,
      koor_ttd_path: ttdPath,
      koor_ttd_focus: parseTtdFocus((profil as { signature_focus: unknown } | null)?.signature_focus),
      banding_batas: tanggalSql(tambahHariKerja(kini, MASA_BANDING_HARI_KERJA)),
    })
    .in('id', layak.map(r => r.id))

  if (error) return { error: galatKolom(error.message) }

  await Promise.all(layak.map(r =>
    catatRiwayat({ kpiId: r.id, pemilikId: r.teacher_id, year: r.year, month: r.month, versi: r.versi, aksi: 'terbit', userId: session.userId }),
  ))

  const c = layak[0]
  segarkan(c.unit, c.year, c.month)
  return { success: true, jumlah: layak.length }
}

/**
 * Kembalikan rapor ke SDM tanpa menandatanganinya.
 *
 * Alasan wajib. Koordinator adalah pembaca pertama di luar SDM, dan tanpa
 * jalur pulang ia hanya punya dua pilihan: menandatangani sesuatu yang ia
 * tahu keliru, atau mendiamkannya sampai tenggat lewat. Alasan yang kosong
 * membuat jalur ini ada tapi tidak berguna — SDM tidak tahu apa yang harus
 * dibetulkan.
 */
export async function kembalikanRaporAction(kpiId: string, alasan: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const teks = alasan.trim()
  if (teks.length < 10) return { error: 'Tuliskan alasan pengembalian, minimal 10 karakter.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select(KOLOM).eq('id', kpiId).maybeSingle()
  const row = data as BarisAlur | null
  if (!row) return { error: 'Rapor tidak ditemukan.' }
  if (!canPublishKpiRapor(session.role, row.unit)) return { error: 'Bukan unit Anda.' }
  if (!bolehDiterbitkan(row.status)) return { error: 'Rapor ini tidak sedang menunggu Anda.' }

  const { error } = await supabase
    .from('kpi_monthly')
    .update({ status: 'dikembalikan', dikembalikan_alasan: teks })
    .eq('id', kpiId)

  if (error) return { error: galatKolom(error.message) }

  await catatRiwayat({
    kpiId, pemilikId: row.teacher_id, year: row.year, month: row.month,
    versi: row.versi, aksi: 'dikembalikan', userId: session.userId, catatan: teks,
  })
  segarkan(row.unit, row.year, row.month)
  return { success: true }
}

// ── Guru: menandatangani ───────────────────────────────────────────

/**
 * Guru menyatakan menerima rapornya.
 *
 * Gambar tanda tangan bersifat pilihan. Yang mengikat adalah kehendaknya —
 * dicatat sebagai guru_ttd_at oleh sesi yang hanya bisa dibuka olehnya — bukan
 * gambarnya. Mewajibkan gambar akan menahan persetujuan seorang guru yang
 * kebetulan belum sempat memotret tanda tangannya, dan menahan persetujuan
 * bukan tujuan fitur ini.
 *
 * Rapor yang sudah 'selesai' masih boleh ditandatangani: guru yang bandingnya
 * diputus di tingkat akhir tetap berhak menyatakan menerima. Yang tidak boleh
 * adalah menandatangani saat banding masih menggantung — itu dua pernyataan
 * yang saling meniadakan.
 */
export async function ttdGuruAction(kpiId: string): Promise<Hasil> {
  const guru = await getTeacherSession()
  if (!guru) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select(KOLOM).eq('id', kpiId).maybeSingle()
  const row = data as BarisAlur | null
  if (!row) return { error: 'Rapor tidak ditemukan.' }
  if (row.teacher_id !== guru.teacherId) return { error: 'Bukan rapor Anda.' }
  if (!bolehTtdGuru(row.status, Boolean(row.guru_ttd_at))) {
    return { error: 'Rapor ini tidak bisa ditandatangani sekarang.' }
  }

  const { data: profil } = await supabase
    .from('teachers')
    .select('signature_path, signature_focus')
    .eq('id', guru.teacherId)
    .maybeSingle()

  const p = profil as { signature_path: string | null; signature_focus: unknown } | null

  // Rapor yang ditandatangani saat masih 'terbit' menjadi selesai karena
  // gurunya setuju. Yang ditandatangani setelah final karena tenggat atau
  // putusan tetap membawa sebab aslinya — sebab itulah yang benar, dan
  // menimpanya akan menghapus catatan bahwa rapor ini pernah disengketakan
  // atau pernah didiamkan sampai tenggatnya lewat.
  const patch: Record<string, unknown> = {
    guru_ttd_at: new Date().toISOString(),
    guru_ttd_path: p?.signature_path ?? null,
    guru_ttd_focus: parseTtdFocus(p?.signature_focus),
  }
  if (row.status === 'terbit') {
    patch.status = 'selesai'
    patch.selesai_sebab = 'ttd_guru'
  }

  const { error } = await supabase.from('kpi_monthly').update(patch).eq('id', kpiId)
  if (error) return { error: galatKolom(error.message) }

  await catatRiwayat({
    kpiId, pemilikId: row.teacher_id, year: row.year, month: row.month,
    versi: row.versi, aksi: 'ttd_guru', teacherId: guru.teacherId,
  })
  segarkan(row.unit, row.year, row.month)
  revalidatePath(`/guru/rapor-kpi/${row.year}/${row.month}`)
  return { success: true }
}

// ── Kepala RQ: membuka kunci ───────────────────────────────────────

/**
 * Reset penilaian: hapus baris rapornya sama sekali.
 *
 * Hanya Kepala RQ. SDM sengaja tidak: memberi hak menghapus dokumen terbit
 * kepada pihak yang sama yang menyusunnya membuat tanda tangan guru tidak
 * menjamin apa pun.
 *
 * KENAPA DIHAPUS, BUKAN DIKOSONGKAN
 *
 * Versi pertama menolkan seluruh angkanya dan mengembalikan status ke draft.
 * Itu keliru, dan kekeliruannya tidak kelihatan sampai ada yang mereset: di
 * rubrik ini NOL BERARTI SEMPURNA untuk empat indikator — nol menit terlambat
 * adalah kehadiran tanpa cela, nol kasus izin adalah tanpa pelanggaran —
 * ditambah dua indikator bernilai basis. Rapor yang "dikosongkan" tetap
 * menghitung 40,4 dan tampil sebagai penilaian sungguhan berpredikat "Sangat
 * Kurang Sekali", lalu ikut terbawa ke rata-rata rapor semester gurunya.
 *
 * Menandainya "kosong" lalu menyaringnya juga ditolak: ada delapan tempat yang
 * membaca kpi_monthly, dan saringan yang harus diingat di delapan tempat cepat
 * atau lambat terlupa di salah satunya — tanpa gagal, hanya diam-diam salah.
 * Tanpa baris, "belum dinilai" kembali menjadi keadaan yang sudah dipahami
 * seluruh modul sejak awal.
 *
 * Jejaknya tetap ada: riwayat dicatat SEBELUM penghapusan, dan sejak 0051
 * kunci asingnya ON DELETE SET NULL dengan identitas periode yang disalin —
 * jadi catatannya bertahan dan muncul kembali saat periode itu dinilai ulang.
 */
export async function resetRaporAction(kpiId: string, alasan: string): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canResetKpiRapor(session.role)) {
    return { error: 'Hanya Kepala RQ yang bisa menghapus penilaian KPI.' }
  }

  const teks = alasan.trim()
  if (teks.length < 10) return { error: 'Tuliskan alasan reset, minimal 10 karakter.' }

  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select(KOLOM).eq('id', kpiId).maybeSingle()
  const row = data as BarisAlur | null
  if (!row) return { error: 'Rapor tidak ditemukan.' }

  // Dicatat lebih dulu, selagi barisnya masih ada — sesudah dihapus,
  // kpi_monthly_id-nya menjadi NULL sendiri dan identitas periode di baris
  // riwayat inilah yang menjaganya tetap bisa ditelusuri.
  await catatRiwayat({
    kpiId,
    pemilikId: row.teacher_id,
    year: row.year,
    month: row.month,
    versi: row.versi,
    aksi: 'direset',
    userId: session.userId,
    catatan: `Penilaian dihapus dari status "${row.status}" (versi ${row.versi}). ${teks}`,
  })

  const { error } = await supabase.from('kpi_monthly').delete().eq('id', kpiId)
  if (error) return { error: galatKolom(error.message) }

  segarkan(row.unit, row.year, row.month)
  return { success: true }
}

/** Apakah rapor ini sedang terkunci — dipakai halaman isian SDM. */
export async function raporTerkunci(kpiId: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data } = await supabase.from('kpi_monthly').select('status').eq('id', kpiId).maybeSingle()
  return terkunci(((data as { status: KpiRaporStatus } | null)?.status) ?? 'draft')
}

/**
 * Pesan galat yang menyebut migrasinya, mengikuti kebiasaan simpanKpiAction.
 *
 * Kolom alur baru ada setelah 0050. Tanpa penjelasan ini, tombol "Terbitkan"
 * hanya akan gagal diam-diam pada pemasangan yang migrasinya belum dijalankan,
 * dan tidak ada di layar yang menunjukkan apa yang kurang.
 */
function galatKolom(pesan: string): string {
  const kolomBaru = ['status', 'versi', 'terbit_at', 'koor_ttd_path', 'banding_batas']
  if (kolomBaru.some(k => pesan?.includes(k))) {
    return 'Alur pengesahan rapor belum aktif: jalankan drizzle/0050_rapor_kpi_pengesahan_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  if (pesan?.includes('terkunci')) {
    return 'Rapor ini sudah terbit dan terkunci. Kepala RQ harus mereset rapornya lebih dulu.'
  }
  return 'Gagal memperbarui status rapor.'
}
