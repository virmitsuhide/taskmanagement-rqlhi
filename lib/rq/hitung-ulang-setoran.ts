import type { createServerClient } from '@/lib/supabase/server'
import { posisiLanjut, type BacaanQuran } from '@/lib/rq/bacaan-quran'
import { ayatPerJuz } from '@/lib/rq/batas-juz'
import { getMateriPerJilid, getHasilMateriPerSiswa, ringkasProgres, type HasilMateri } from '@/lib/data/materi-tahsin'

/**
 * Hitung ulang turunan setoran setelah sebuah setoran hilang dari riwayat —
 * dikoreksi/dihapus pengurus, atau ditimpa guru di hari yang sama.
 *
 * Dipisah dari berkas action supaya kedua jalur itu memakai SATU pemutaran
 * ulang yang sama; dua salinan aturan posisi adalah dua tempat yang bisa
 * berbeda pendapat tentang di halaman mana seorang anak berada.
 */

type Supabase = ReturnType<typeof createServerClient>

interface PosisiQuran {
  current_quran_halaman: number | null
  current_quran_surat_id: number | null
  current_quran_ayat: number | null
}

/** Posisi mushaf sesudah sebuah bacaan; panjang surah diambil dari surat_master. */
async function posisiQuranBerikutnya(supabase: Supabase, bacaan: BacaanQuran): Promise<PosisiQuran> {
  const { data: suratRow } = await supabase
    .from('surat_master')
    .select('total_ayat')
    .eq('id', bacaan.surat_id)
    .maybeSingle()
  const p = posisiLanjut(bacaan, (suratRow as { total_ayat: number } | null)?.total_ayat ?? null)
  return {
    current_quran_halaman: p.halaman,
    current_quran_surat_id: p.surat_id,
    current_quran_ayat: p.ayat,
  }
}

/**
 * Hitung ulang posisi siswa dari seluruh setoran tahsinnya.
 *
 * Diputar ulang dari awal secara kronologis, mengikuti aturan yang sama
 * dengan saat setoran dibuat (resolveStudentPosition di actions/setoran.ts):
 * 'lulus' memajukan satu halaman, 'ulang' mempertahankan posisi, setoran
 * DRILL tidak menggeser halaman, lulus di halaman terakhir berhenti di
 * halaman itu, dan kenaikan jilid memindahkan ke jilid berikutnya dengan
 * halaman kembali ke 1.
 *
 * Diputar ulang seluruhnya, bukan dihitung mundur dari posisi sekarang,
 * karena posisi sekarang bisa saja sudah menyimpang — dan pemutaran ulang
 * memperbaikinya sekalian.
 */
export async function recalcPosisi(supabase: Supabase, studentId: string): Promise<void> {
  const { data: logRows } = await supabase
    .from('tahsin_logs')
    .select('id, method_id, jilid_id, halaman, status, drill, setoran_date, created_at, quran_halaman, quran_surat_id, quran_ayat_dari, quran_ayat_ke')
    .eq('student_id', studentId)
    .order('setoran_date', { ascending: true })
    .order('created_at', { ascending: true })

  const logs = (logRows ?? []) as {
    id: string; method_id: string | null; jilid_id: string | null
    halaman: number | null; status: string; drill: boolean | null
    quran_halaman: number | null; quran_surat_id: number | null
    quran_ayat_dari: number | null; quran_ayat_ke: number | null
  }[]

  // Setoran habis seluruhnya: kosongkan posisi supaya tidak ada sisa angka
  // yang tak punya riwayat pendukung.
  if (logs.length === 0) {
    await supabase
      .from('students')
      .update({
        current_method_id: null, current_jilid_id: null, current_jilid_page: null,
        current_quran_halaman: null, current_quran_surat_id: null, current_quran_ayat: null,
      })
      .eq('id', studentId)
    return
  }

  const jilidIds = [...new Set(logs.map(l => l.jilid_id).filter((x): x is string => Boolean(x)))]
  const [{ data: promRows }, { data: jilidRows }] = await Promise.all([
    supabase
      .from('jilid_promotions')
      .select('source_log_id, to_jilid_id')
      .eq('student_id', studentId)
      .not('source_log_id', 'is', null),
    jilidIds.length
      ? supabase.from('jilid_levels').select('id, total_pages').in('id', jilidIds)
      : Promise.resolve({ data: [] }),
  ])

  const promosiDari = new Map(
    ((promRows ?? []) as { source_log_id: string; to_jilid_id: string }[])
      .map(p => [p.source_log_id, p.to_jilid_id]),
  )
  const totalHalaman = new Map(
    ((jilidRows ?? []) as { id: string; total_pages: number | null }[]).map(j => [j.id, j.total_pages]),
  )

  let method: string | null = null
  let jilid: string | null = null
  let page: number | null = null
  /*
    Posisi mushaf tidak ikut diputar setoran demi setoran, cukup setoran
    LULUS terakhir yang memuat bacaan. Bedanya dari halaman buku: mushaf tidak
    punya kenaikan jilid yang mengembalikan hitungan ke 1, jadi tidak ada
    riwayat yang perlu ditumpuk — catatan terakhir sudah menyimpan seluruh
    jawabannya. Bacaan selama drill tetap dihitung, sama seperti saat disetor.
  */
  let bacaanTerakhir: BacaanQuran | null = null

  for (const log of logs) {
    if (log.status === 'lulus') {
      if (!log.drill) {
        method = log.method_id
        jilid = log.jilid_id
        if (log.halaman !== null) {
          const total = log.jilid_id ? totalHalaman.get(log.jilid_id) ?? null : null
          page = total !== null && log.halaman >= total ? total : log.halaman + 1
        }
      }
      if (log.quran_surat_id !== null) {
        bacaanTerakhir = {
          halaman: log.quran_halaman,
          surat_id: log.quran_surat_id,
          ayat_dari: log.quran_ayat_dari,
          ayat_ke: log.quran_ayat_ke,
        }
      }
    }
    const naik = promosiDari.get(log.id)
    if (naik) {
      jilid = naik
      page = 1
    }
  }

  const posisiQuran: PosisiQuran = bacaanTerakhir
    ? await posisiQuranBerikutnya(supabase, bacaanTerakhir)
    : { current_quran_halaman: null, current_quran_surat_id: null, current_quran_ayat: null }

  /*
    Tahap berbasis materi (Gharib/Tajwid) tidak bisa diputar ulang lewat
    halaman: di sana halaman hanyalah turunan, dan "halaman + 1" akan
    melewati materi lain yang masih sehalaman. Posisinya diambil dari materi
    yang tersisa — daftar yang sudah menyusut sendiri, sebab menghapus
    setoran ikut menghapus klaim hafalnya lewat CASCADE.
  */
  if (jilid) {
    const materi = (await getMateriPerJilid([jilid])).get(jilid) ?? []
    if (materi.length > 0) {
      const hafal = (await getHasilMateriPerSiswa([studentId])).get(studentId) ?? new Map<string, HasilMateri>()
      const progres = ringkasProgres(materi, hafal)
      page = progres.berikutnya?.halaman ?? materi[materi.length - 1].halaman
    }
  }

  await supabase
    .from('students')
    .update({ current_method_id: method, current_jilid_id: jilid, current_jilid_page: page, ...posisiQuran })
    .eq('id', studentId)
}

/**
 * Selaraskan penanda mutqin dengan kenaikan juz yang masih tersisa.
 *
 * Kenaikan juz ikut terhapus lewat CASCADE, tapi `juz_progress.mutqin` adalah
 * baris terpisah yang tidak ikut. Kalau dibiarkan, juz tetap tampak tuntas
 * padahal setoran yang menuntaskannya sudah tidak ada.
 */
export async function recalcMutqin(supabase: Supabase, studentId: string): Promise<void> {
  const [{ data: promRows }, { data: progRows }] = await Promise.all([
    supabase.from('juz_promotions').select('juz_number').eq('student_id', studentId),
    supabase.from('juz_progress').select('juz_number, mutqin').eq('student_id', studentId),
  ])

  const masihNaik = new Set(((promRows ?? []) as { juz_number: number }[]).map(p => p.juz_number))
  const progress = (progRows ?? []) as { juz_number: number; mutqin: boolean }[]

  // Hanya juz yang penanda mutqin-nya kini tidak berdasar yang diturunkan;
  // mutqin yang ditetapkan lewat jalur lain tidak ikut disentuh.
  const perluTurun = progress.filter(p => p.mutqin && !masihNaik.has(p.juz_number))
  for (const p of perluTurun) {
    await supabase
      .from('juz_progress')
      .update({ mutqin: false, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('juz_number', p.juz_number)
  }
}

/**
 * Kurangi ayat_hafal juz_progress sebanyak ziyadah yang dihapus.
 *
 * Trigger upsert_juz_progress hanya MENAMBAH saat setoran masuk; tidak ada
 * padanannya saat setoran keluar. Ziyadah yang ditimpa tanpa pengurangan ini
 * terhitung dua kali di bilah progres juz — sekali dari setoran lama, sekali
 * dari penggantinya. Rumusnya cermin persis trigger itu sejak 0079: setoran
 * dibagi menurut batas juz mushaf (ayatPerJuz), bukan dimasukkan seluruhnya
 * ke juz awal surat — dan tidak pernah turun di bawah 0.
 */
export async function kurangiJuzProgress(
  supabase: Supabase,
  log: { student_id: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null },
): Promise<void> {
  if (log.ayat_dari === null || log.ayat_ke === null) return
  for (const [juz, jumlah] of ayatPerJuz(log.surat_id, log.ayat_dari, log.ayat_ke)) {
    const { data: prog } = await supabase
      .from('juz_progress')
      .select('ayat_hafal')
      .eq('student_id', log.student_id)
      .eq('juz_number', juz)
      .maybeSingle()
    if (!prog) continue

    const sisa = Math.max(0, (prog as { ayat_hafal: number }).ayat_hafal - jumlah)
    await supabase
      .from('juz_progress')
      .update({ ayat_hafal: sisa, updated_at: new Date().toISOString() })
      .eq('student_id', log.student_id)
      .eq('juz_number', juz)
  }
}
