'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getSession } from '@/lib/auth/session'
import { canManageGukar, canManageGukarSetoran } from '@/lib/auth/permissions'
import { formatPeriod, isValidPeriod, toPeriodDate } from '@/lib/finance/period'
import { hariIni } from '@/lib/rutin/periode'
import { STANDAR_BY_KEY, TAHAP_TAHSIN, tahapTahsinDari } from '@/lib/rq/gukar-standar'
import {
  setoranTahsinBulanIni, setoranTahfidzBulanIni, suratTahsinTersedia, type TahapJilid,
} from '@/lib/rq/gukar-setoran'
import { akhirBulan, labelHariSetor, statusSetoranBulan } from '@/lib/rq/gukar-siklus'
import type { GukarStatusPegawai } from '@/types'

type Result = { error?: string; success?: boolean }
type Supabase = ReturnType<typeof createServerClient>

/**
 * Angka dari form, atau NULL bila dikosongkan.
 *
 * Kosong dan nol berbeda artinya di sini: "0 juz tuntas" adalah pengukuran,
 * sedangkan kolom kosong berarti belum diukur — dan analitik memperlakukan
 * keduanya berbeda saat menghitung cakupan data.
 */
function angkaAtauNull(nilai: unknown, min: number, max: number): number | null {
  const teks = String(nilai ?? '').trim()
  if (!teks) return null
  const angka = Number(teks)
  if (!Number.isFinite(angka)) return null
  return Math.min(max, Math.max(min, Math.round(angka)))
}

type Pengampu = {
  teacherId: string | null
  groupId: string
  /**
   * true = SDM / Kepala RQ lewat akun pengurus. Pengurus boleh mengoreksi
   * setoran bulan yang sudah terkunci; pengampu tidak.
   */
  pengurus: boolean
}

/**
 * Pengisian capaian pembinaan dilakukan pengampu lewat portal /guru.
 *
 * Izinnya tidak ditentukan role melainkan PENUGASAN: yang boleh mengisi hanya
 * guru yang tercatat sebagai pengampu kelompok itu. Diperiksa ke database tiap
 * kali, bukan dititipkan lewat form — id kelompok datang dari peramban dan
 * karenanya tidak boleh dipercaya.
 */
async function guardPengampu(groupId: string): Promise<Pengampu | { error: string }> {
  if (!groupId) return { error: 'Kelompok tidak dikenali.' }

  const supabase = createServerClient()
  const { data: group } = await supabase
    .from('gukar_groups')
    .select('id, pengampu_id')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return { error: 'Kelompok tidak ditemukan.' }

  // Jalur pertama: pengampu kelompok itu sendiri, lewat portal guru.
  const teacher = await getTeacherSession()
  if (teacher) {
    if (group.pengampu_id !== teacher.teacherId) {
      return { error: 'Anda bukan pengampu kelompok ini.' }
    }
    // Batas sesungguhnya ada di sini, bukan di halaman: menyembunyikan menu
    // tidak menghentikan pengiriman langsung ke server action.
    if (!(await bolehMengampuGukar(teacher.teacherId))) {
      return { error: 'Pembinaan gukar hanya diampu guru Tetap Yayasan & Kontrak Yayasan.' }
    }
    return { teacherId: teacher.teacherId, groupId, pengurus: false }
  }

  // Jalur kedua: SDM sebagai pemilik program, dan Kepala RQ. Keduanya masuk
  // lewat akun pengurus, bukan akun guru, sehingga sesinya berbeda jenis.
  // recorded_by dibiarkan null — kolom itu merujuk tabel teachers, dan
  // pengurus yang mengoreksi belum tentu punya baris di sana.
  const pengurus = await getSession()
  if (pengurus && canManageGukarSetoran(pengurus.role)) {
    return { teacherId: null, groupId, pengurus: true }
  }

  return { error: 'Sesi tidak valid atau tidak memiliki izin.' }
}

function segarkan(groupId: string) {
  revalidatePath(`/guru/gukar/${groupId}`)
  revalidatePath(`/guru/gukar/${groupId}/sesi`)
  revalidatePath('/dashboard/analitik/gukar')
}

/** Peserta beserta metodenya — sekaligus bukti ia anggota kelompok ini. */
async function pesertaKelompok(supabase: Supabase, groupId: string, participantId: string) {
  const { data } = await supabase
    .from('gukar_participants')
    .select('id, metode_id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  return (data ?? null) as { id: string; metode_id: string | null } | null
}

/**
 * METODE DIKUNCI DI SERVER, BUKAN HANYA DI FORM.
 *
 * Formulir memang menonaktifkan pilihan metode begitu terisi, tapi select
 * yang dinonaktifkan hanya menghentikan orang yang memakai formulirnya.
 * Nilai baru hanya diterima bila kolomnya memang masih kosong; sesudah itu
 * kiriman apa pun yang berbeda ditolak, bukan diam-diam diabaikan —
 * pengampu perlu tahu kalau ia sedang mencoba hal yang tidak diizinkan.
 */
async function tetapkanMetode(
  supabase: Supabase,
  participant: { id: string; metode_id: string | null },
  diminta: string | null,
): Promise<{ metodeId: string | null } | { error: string }> {
  const terkunci = participant.metode_id
  if (terkunci && diminta && diminta !== terkunci) {
    return { error: 'Metode tahsin sudah ditetapkan dan tidak bisa diganti.' }
  }
  const metodeId = terkunci ?? diminta
  if (!terkunci && metodeId) {
    await supabase.from('gukar_participants').update({ metode_id: metodeId }).eq('id', participant.id)
  }
  return { metodeId }
}

/** Kolom baris bulan ini yang menentukan awal/sedang dan kunci. */
type BarisBulan = {
  awal_tanggal: string | null
  setoran_terakhir: string | null
  jumlah_setoran: number
  dikunci_at: string | null
}

async function barisBulanIni(supabase: Supabase, participantId: string, periodKey: string) {
  const { data } = await supabase
    .from('gukar_monthly')
    .select('awal_tanggal, setoran_terakhir, jumlah_setoran, dikunci_at')
    .eq('participant_id', participantId)
    .eq('period', toPeriodDate(periodKey))
    .maybeSingle()
  return (data ?? null) as BarisBulan | null
}

/**
 * Kapan setoran bulan ini dikunci untuk seluruh kelompok, bila pernah.
 *
 * Kunci ditulis ke tiap baris bulanan, tapi dibaca per KELOMPOK: peserta
 * yang belum punya baris saat tombol kunci ditekan tidak boleh lolos
 * menambah setoran sesudahnya hanya karena barisnya lahir belakangan.
 */
async function kunciKelompok(supabase: Supabase, groupId: string, periodKey: string): Promise<string | null> {
  const { data: anggota } = await supabase.from('gukar_participants').select('id').eq('group_id', groupId)
  const ids = ((anggota ?? []) as { id: string }[]).map(p => p.id)
  if (ids.length === 0) return null
  const { data } = await supabase
    .from('gukar_monthly')
    .select('dikunci_at')
    .in('participant_id', ids)
    .eq('period', toPeriodDate(periodKey))
    .not('dikunci_at', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data as { dikunci_at: string } | null)?.dikunci_at ?? null
}

/** Salin posisi "sedang" menjadi posisi "awal". */
function sebagaiAwal(isi: KolomSetoran) {
  return {
    awal_jilid_id: isi.jilid_id,
    awal_halaman: isi.halaman,
    awal_tahsin_surat: isi.tahsin_surat,
    awal_tahsin_ayat: isi.tahsin_ayat,
    awal_tahfidz_surat: isi.tahfidz_surat,
    awal_tahfidz_ayat: isi.tahfidz_ayat,
  }
}

const adaPosisi = (isi: KolomSetoran) => Boolean(isi.jilid_id || isi.tahfidz_surat)

// ─── Setor per sesi ──────────────────────────────────────────────────────────

export interface InputSetorGukar {
  participant_id: string
  /** Hanya dipakai bila metode peserta belum ditetapkan. */
  metode_id: string | null
  jilid_id: string | null
  halaman: number | null
  tahsin_surat: number | null
  tahsin_ayat: number | null
  tahfidz_surat: number | null
  tahfidz_ayat: number | null
}

export type HasilSetorGukar = {
  tersimpan: number
  gagal: { participant_id: string; pesan: string }[]
  error?: string
}

/**
 * Setoran beberapa peserta sekaligus pada satu tanggal.
 *
 * AWAL, SEDANG, AKHIR
 *
 * Setoran pertama di bulan itu disalin ke kolom awal_*. Setiap setoran
 * sesudahnya menimpa posisi SEDANG (kolom posisi biasa). Begitu bulannya
 * terkunci — ditekan pengampu, atau tanggalnya sudah lewat — posisi sedang
 * itulah setoran AKHIR bulan itu.
 *
 * Tanggal setoran tidak boleh mundur dari setoran terakhir yang tercatat:
 * setoran yang lebih lama tidak bisa menjadi "sedang", dan diam-diam
 * menyimpannya sebagai sedang akan membuat posisi terbaru hilang tertimpa.
 * Setoran di tanggal yang sama dengan yang terakhir diperlakukan sebagai
 * ralat — posisinya ditimpa, hitungan hari setor tidak bertambah.
 */
export async function setorSesiGukarAction(
  groupId: string,
  tanggal: string,
  baris: InputSetorGukar[],
): Promise<HasilSetorGukar> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return { tersimpan: 0, gagal: [], error: auth.error }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { tersimpan: 0, gagal: [], error: 'Tanggal tidak valid.' }
  const hari = hariIni()
  if (tanggal > hari) return { tersimpan: 0, gagal: [], error: 'Tanggal setor tidak boleh melewati hari ini.' }
  if (baris.length === 0) return { tersimpan: 0, gagal: [], error: 'Belum ada peserta yang diisi.' }

  const periodKey = tanggal.slice(0, 7)
  const supabase = createServerClient()
  if (!auth.pengurus && statusSetoranBulan(periodKey, hari, await kunciKelompok(supabase, groupId, periodKey)) !== 'berjalan') {
    return { tersimpan: 0, gagal: [], error: `Setoran ${formatPeriod(periodKey)} sudah dikunci sebagai setoran akhir.` }
  }

  const gagal: HasilSetorGukar['gagal'] = []
  let tersimpan = 0

  for (const b of baris) {
    const pesan = await setorSatu(supabase, auth, periodKey, tanggal, b)
    if (pesan) gagal.push({ participant_id: b.participant_id, pesan })
    else tersimpan++
  }

  segarkan(groupId)
  return { tersimpan, gagal }
}

async function setorSatu(
  supabase: Supabase,
  auth: Pengampu,
  periodKey: string,
  tanggal: string,
  b: InputSetorGukar,
): Promise<string | null> {
  const participant = await pesertaKelompok(supabase, auth.groupId, b.participant_id)
  if (!participant) return 'Peserta bukan anggota kelompok ini.'

  const kini = await barisBulanIni(supabase, participant.id, periodKey)
  if (kini?.setoran_terakhir && tanggal < kini.setoran_terakhir) {
    return `Sudah ada setoran lebih baru (${labelHariSetor(kini.setoran_terakhir)}). Ralat lewat papan bulanan.`
  }

  const metode = await tetapkanMetode(supabase, participant, b.metode_id?.trim() || null)
  if ('error' in metode) return metode.error

  const isi = await bacaSetoran(supabase, b, participant.id, periodKey, metode.metodeId)
  if ('error' in isi) return isi.error
  if (!adaPosisi(isi)) return 'Isi posisi tahsin atau tahfidz.'

  const { tahap_turunan, ...posisi } = isi
  const hariBaru = !kini?.setoran_terakhir || tanggal > kini.setoran_terakhir
  // Awal ditulis saat belum ada, atau saat setoran ini meralat hari awal itu
  // sendiri (satu-satunya setoran bulan ini, di tanggal yang sama).
  const tulisAwal = !kini?.awal_tanggal || (!hariBaru && tanggal === kini.awal_tanggal)

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participant.id,
      period: toPeriodDate(periodKey),
      ...posisi,
      ...(tahap_turunan ? { tahap_tahsin: tahap_turunan } : {}),
      ...(tulisAwal ? { ...sebagaiAwal(isi), awal_tanggal: tanggal } : {}),
      setoran_terakhir: tanggal,
      jumlah_setoran: (kini?.jumlah_setoran ?? 0) + (hariBaru ? 1 : 0),
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )
  return error ? error.message || 'Gagal menyimpan setoran.' : null
}

// ─── Papan bulanan ───────────────────────────────────────────────────────────

/**
 * Simpan capaian bulanan satu peserta dari papan bulanan.
 *
 * Formulir ini jalur RALAT: posisi yang dikirim menimpa setoran sedang tanpa
 * menambah hitungan hari setor. Kalau bulan ini belum punya setoran awal
 * (atau baru satu hari setor), posisi yang sama sekaligus menjadi awalnya.
 *
 * Setelah bulannya terkunci, pengampu tetap bisa menyimpan nilai & catatan —
 * yang dibekukan hanya POSISI, karena itulah setoran akhirnya.
 */
export async function saveGukarMonthlyAction(_: unknown, formData: FormData): Promise<Result> {
  const groupId = (formData.get('group_id') as string) ?? ''
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth

  const participantId = (formData.get('participant_id') as string) ?? ''
  const periodKey = (formData.get('period') as string) ?? ''
  if (!participantId) return { error: 'Peserta tidak dikenali.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  // Pastikan pesertanya memang anggota kelompok yang diampu — tanpa ini,
  // id peserta mana pun bisa dititipkan lewat form.
  const participant = await pesertaKelompok(supabase, groupId, participantId)
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const hari = hariIni()
  const kini = await barisBulanIni(supabase, participantId, periodKey)
  const posisiBeku = !auth.pengurus &&
    statusSetoranBulan(periodKey, hari, await kunciKelompok(supabase, groupId, periodKey)) !== 'berjalan'

  let kolomPosisi: Record<string, unknown> = {}
  if (!posisiBeku) {
    const metode = await tetapkanMetode(
      supabase, participant, ((formData.get('metode_id') as string) ?? '').trim() || null,
    )
    if ('error' in metode) return metode

    const isi = await bacaSetoran(
      supabase,
      {
        jilid_id: formData.get('jilid_id') as string | null,
        halaman: formData.get('halaman'),
        tahsin_surat: formData.get('tahsin_surat'),
        tahsin_ayat: formData.get('tahsin_ayat'),
        tahfidz_surat: formData.get('tahfidz_surat'),
        tahfidz_ayat: formData.get('tahfidz_ayat'),
      },
      participantId, periodKey, metode.metodeId,
    )
    if ('error' in isi) return isi

    /*
      tahap_tahsin TIDAK LAGI DIKETIK — DITURUNKAN.

      Sejak formulir memakai metode & jilid dari jilid_levels, kolom lama ini
      diisikan sistem dari tahap yang dipilih. Ia dipertahankan karena seluruh
      analitik SDM dan laporan 2026 menggolongkan gukar lewat kolom ini;
      membiarkannya kosong akan membuat catatan baru masuk sebagai "tak
      tercatat" padahal datanya justru lebih lengkap dari sebelumnya.

      Kiriman manual masih diterima demi jalur lama (rekap yang disunting
      pengurus), tapi turunan dari jilid selalu menang bila keduanya ada.
    */
    const tahapKiriman = ((formData.get('tahap_tahsin') as string) ?? '').trim()
    if (tahapKiriman && !(TAHAP_TAHSIN as readonly string[]).includes(tahapKiriman)) {
      return { error: 'Tahap tahsin tidak dikenali.' }
    }

    const { tahap_turunan, ...posisi } = isi
    kolomPosisi = { ...posisi, tahap_tahsin: tahap_turunan || tahapKiriman }

    if (adaPosisi(isi)) {
      // Ralat tanpa tanggal: bila bulan ini belum pernah disetor, hari ini
      // (atau tanggal terakhir bulan itu, untuk bulan yang sudah lewat)
      // menjadi tanggal setorannya.
      const tanggal = kini?.setoran_terakhir ?? (hari < akhirBulan(periodKey) ? hari : akhirBulan(periodKey))
      if (!kini?.awal_tanggal || (kini.jumlah_setoran ?? 0) <= 1) {
        Object.assign(kolomPosisi, sebagaiAwal(isi), { awal_tanggal: kini?.awal_tanggal ?? tanggal })
      }
      Object.assign(kolomPosisi, {
        setoran_terakhir: tanggal,
        jumlah_setoran: Math.max(1, kini?.jumlah_setoran ?? 0),
      })
    }
  }

  const juzTuntas = angkaAtauNull(formData.get('juz_tuntas'), 0, 30)
  const juzBerjalan = angkaAtauNull(formData.get('juz_berjalan'), 1, 30)
  const nilaiTahfidz = angkaAtauNull(formData.get('nilai_tahfidz'), 0, 100)
  const suratPilihan = angkaAtauNull(formData.get('surat_pilihan'), 0, 30) ?? 0

  // Kehadiran sengaja tidak ditulis di sini — ia punya jalurnya sendiri
  // (simpanKehadiranBulanAction), dan menulis ulang kolomnya dari formulir
  // yang tidak memuatnya akan mengosongkan rekap yang sudah diisi.
  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      capaian_tahsin: ((formData.get('capaian_tahsin') as string) ?? '').trim(),
      capaian_tahfidz: ((formData.get('capaian_tahfidz') as string) ?? '').trim(),
      juz_tuntas: juzTuntas,
      juz_berjalan: juzBerjalan,
      nilai_tahfidz: nilaiTahfidz,
      surat_pilihan: suratPilihan,
      ...kolomPosisi,
      catatan: ((formData.get('catatan') as string) ?? '').trim(),
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan catatan.' }

  segarkan(groupId)
  return { success: true }
}

/**
 * Rekap kehadiran satu bulan untuk seluruh kelompok, sekali simpan.
 *
 * Pengampu memegang catatan kehadiran manual dan memindahkannya ke sistem di
 * akhir bulan: hadir sekian dari sekian siklus Senin–Jumat. Penyebutnya satu
 * untuk satu kelompok — siklus yang terlaksana sama bagi semua anggotanya —
 * tapi tetap disimpan per baris supaya rekap semester cukup menjumlahkan.
 *
 * Kehadiran TIDAK ikut terkunci bersama setoran akhir: justru diisinya
 * setelah bulan selesai. Yang ditolak hanya bulan yang belum dimulai.
 */
export async function simpanKehadiranBulanAction(
  groupId: string,
  periodKey: string,
  siklus: number,
  isian: { participant_id: string; hadir: number | null }[],
): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (periodKey > hariIni().slice(0, 7)) return { error: 'Bulan itu belum berjalan.' }
  if (!Number.isInteger(siklus) || siklus < 1 || siklus > 6) {
    return { error: 'Jumlah siklus harus 1–6.' }
  }
  for (const r of isian) {
    if (r.hadir !== null && (!Number.isInteger(r.hadir) || r.hadir < 0 || r.hadir > siklus)) {
      return { error: `Jumlah hadir harus 0–${siklus}.` }
    }
  }

  const supabase = createServerClient()
  const { data: anggota } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('group_id', groupId)
  const sah = new Set(((anggota ?? []) as { id: string }[]).map(p => p.id))
  if (isian.some(r => !sah.has(r.participant_id))) {
    return { error: 'Ada peserta yang bukan anggota kelompok ini.' }
  }

  const period = toPeriodDate(periodKey)
  const now = new Date().toISOString()

  const terisi = isian.filter(r => r.hadir !== null)
  if (terisi.length > 0) {
    const { error } = await supabase.from('gukar_monthly').upsert(
      terisi.map(r => ({
        participant_id: r.participant_id,
        period,
        jumlah_hadir: r.hadir,
        jumlah_siklus: siklus,
        recorded_by: auth.teacherId,
        updated_at: now,
      })),
      { onConflict: 'participant_id,period' },
    )
    if (error) return { error: error.message || 'Gagal menyimpan kehadiran.' }
  }

  // Dikosongkan = kembali "belum direkap". Hanya menyentuh baris yang sudah
  // ada; tidak ada gunanya membuat baris kosong untuk peserta yang tidak diisi.
  const dikosongkan = isian.filter(r => r.hadir === null).map(r => r.participant_id)
  if (dikosongkan.length > 0) {
    const { error } = await supabase
      .from('gukar_monthly')
      .update({ jumlah_hadir: null, jumlah_siklus: null, updated_at: now })
      .in('participant_id', dikosongkan)
      .eq('period', period)
    if (error) return { error: error.message || 'Gagal menyimpan kehadiran.' }
  }

  segarkan(groupId)
  return { success: true }
}

/**
 * Kunci (atau buka kembali) setoran akhir satu bulan untuk seluruh kelompok.
 *
 * Mengunci lebih awal dipakai saat pembinaan bulan itu sudah tuntas sebelum
 * tanggalnya habis. Setelah tanggal terakhir lewat, kuncinya otomatis dan
 * tidak bisa dibuka dari sini — koreksi bulan lampau adalah wewenang SDM.
 */
export async function kunciSetoranBulanAction(
  groupId: string,
  periodKey: string,
  kunci: boolean,
): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (statusSetoranBulan(periodKey, hariIni(), null) === 'selesai') {
    return { error: `${formatPeriod(periodKey)} sudah lewat — setoran akhirnya terkunci otomatis.` }
  }

  const supabase = createServerClient()
  const { data: anggota } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('group_id', groupId)
  const ids = ((anggota ?? []) as { id: string }[]).map(p => p.id)
  if (ids.length === 0) return { success: true }

  const { error } = await supabase
    .from('gukar_monthly')
    .update({ dikunci_at: kunci ? new Date().toISOString() : null })
    .in('participant_id', ids)
    .eq('period', toPeriodDate(periodKey))

  if (error) return { error: error.message || 'Gagal mengubah kunci setoran.' }

  segarkan(groupId)
  return { success: true }
}

/**
 * Hapus catatan bulanan seorang peserta.
 *
 * Berbeda dengan setoran santri, tidak ada yang perlu dihitung ulang: catatan
 * gukar berdiri sendiri per bulan dan tidak menggeser posisi apa pun.
 * Menghapusnya cukup mengembalikan bulan itu ke keadaan "belum diisi".
 */
export async function deleteGukarMonthlyAction(groupId: string, participantId: string, periodKey: string): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  // Pastikan pesertanya memang anggota kelompok yang diampu — id peserta
  // datang dari peramban dan karenanya tidak boleh dipercaya.
  const participant = await pesertaKelompok(supabase, groupId, participantId)
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  // Bulan yang sudah terkunci berisi setoran akhir — pengampu tidak boleh
  // menghapusnya diam-diam lewat tombol ini.
  if (!auth.pengurus &&
    statusSetoranBulan(periodKey, hariIni(), await kunciKelompok(supabase, groupId, periodKey)) !== 'berjalan') {
    return { error: 'Setoran bulan ini sudah terkunci dan tidak bisa dihapus.' }
  }

  const { error } = await supabase
    .from('gukar_monthly')
    .delete()
    .eq('participant_id', participantId)
    .eq('period', toPeriodDate(periodKey))

  if (error) return { error: error.message || 'Gagal menghapus catatan.' }

  segarkan(groupId)
  return { success: true }
}

/**
 * Tetapkan status kepegawaian & kategori peran seorang peserta.
 *
 * Ini keputusan kepegawaian, bukan catatan pembelajaran — karena itu izinnya
 * bukan "pengampu kelompok" melainkan canManageGukar (SDM & Kepala RQ).
 * Pengampu tetap tidak boleh menandai anggotanya sendiri sebagai calon
 * pegawai tetap: bab 06 laporan SDM memakai daftar itu sebagai dasar
 * percepatan menjelang batas berkas, dan daftarnya harus tunggal.
 */
export async function setGukarProfilPesertaAction(
  participantId: string,
  statusPegawai: GukarStatusPegawai | '',
  kategoriPeran: string,
): Promise<Result> {
  const pengurus = await getSession()
  if (!pengurus || !canManageGukar(pengurus.role)) {
    return { error: 'Anda tidak memiliki izin menetapkan status kepegawaian.' }
  }
  if (!participantId) return { error: 'Peserta tidak dikenali.' }

  const status = statusPegawai || null
  if (status && !['tetap', 'calon_tetap', 'kontrak'].includes(status)) {
    return { error: 'Status kepegawaian tidak dikenali.' }
  }
  if (kategoriPeran && !STANDAR_BY_KEY.has(kategoriPeran)) {
    return { error: 'Kategori peran tidak dikenali.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('gukar_participants')
    .update({ status_pegawai: status, kategori_peran: kategoriPeran })
    .eq('id', participantId)

  if (error) return { error: error.message || 'Gagal menyimpan status peserta.' }

  revalidatePath('/dashboard/analitik/gukar/standar')
  return { success: true }
}

// ─── Setoran terukur (0061) ──────────────────────────────────────────────────

type KolomSetoran = {
  /** Turunan untuk kolom tahap_tahsin — dikeluarkan sebelum menulis ke DB. */
  tahap_turunan: string
  jilid_id: string | null
  halaman: number | null
  tahsin_surat: number | null
  tahsin_ayat: number | null
  tahfidz_surat: number | null
  tahfidz_ayat: number | null
  setoran_tahsin_halaman: number
  setoran_tahfidz_halaman: number
}

/** Isian posisi mentah — dari FormData papan bulanan atau dari setor sesi. */
type IsianPosisi = {
  jilid_id: string | null
  halaman: unknown
  tahsin_surat: unknown
  tahsin_ayat: unknown
  tahfidz_surat: unknown
  tahfidz_ayat: unknown
}

/**
 * Baca posisi tahsin & tahfidz, tegakkan aturannya, lalu hitung jarak yang
 * ditempuh bulan ini.
 *
 * SEMUA ATURAN DITEGAKKAN DI SINI, BUKAN DI FORMULIR
 *
 * Formulir sudah menuntun — dropdown halaman terbatas, pilihan surat dikunci
 * saat suratnya belum tamat. Tapi tuntunan bukan penjagaan: kiriman bisa
 * disusun siapa saja. Yang membuat data tetap masuk akal adalah pemeriksaan
 * di fungsi ini, dan CHECK di migrasi 0061 sebagai jaring terakhirnya. Setor
 * sesi dan papan bulanan sama-sama lewat sini, jadi aturannya tidak bisa
 * berbeda antara keduanya.
 *
 * Jarak dihitung dari catatan TERAKHIR sebelum periode ini — bukan dari bulan
 * kalender sebelumnya. Pembinaan bisa bolong sebulan, dan halaman yang
 * ditempuh selama itu tetap halaman yang ditempuh.
 */
async function bacaSetoran(
  supabase: Supabase,
  isian: IsianPosisi,
  participantId: string,
  periodKey: string,
  metodeId: string | null,
): Promise<KolomSetoran | { error: string }> {
  const jilidId = String(isian.jilid_id ?? '').trim() || null
  const halaman = angkaAtauNull(isian.halaman, 1, 999)
  const tahsinSurat = angkaAtauNull(isian.tahsin_surat, 1, 114)
  const tahsinAyat = angkaAtauNull(isian.tahsin_ayat, 1, 300)
  const tahfidzSurat = angkaAtauNull(isian.tahfidz_surat, 1, 114)
  const tahfidzAyat = angkaAtauNull(isian.tahfidz_ayat, 1, 300)

  // Tahapan metode ini — sekaligus membuktikan jilid yang dikirim memang
  // milik metode yang ditetapkan untuk peserta ini, bukan milik metode lain.
  let tahapan: TahapJilid[] = []
  let namaMetode = ''
  if (metodeId) {
    const { data: m } = await supabase.from('tahsin_methods').select('name').eq('id', metodeId).maybeSingle()
    namaMetode = (m as { name?: string } | null)?.name ?? ''
    const { data } = await supabase
      .from('jilid_levels')
      .select('id, label, order_num, total_pages, is_quran, is_terminal')
      .eq('method_id', metodeId)
      .order('order_num')
    tahapan = (data ?? []) as TahapJilid[]
  }

  const tahap = jilidId ? tahapan.find(t => t.id === jilidId) : null
  if (jilidId && !tahap) return { error: 'Jilid itu bukan tahap dari metode peserta ini.' }

  if (tahap && !tahap.is_quran && !tahap.is_terminal) {
    const maks = tahap.total_pages ?? 0
    if (halaman !== null && maks > 0 && halaman > maks) {
      return { error: `${tahap.label} hanya ${maks} halaman.` }
    }
  }

  // Panjang surah dari surat_master — dipakai memeriksa nomor ayat dan
  // menentukan apakah sebuah surat sudah tamat.
  const { data: suratRows } = await supabase.from('surat_master').select('id, total_ayat')
  const panjang = new Map<number, number>(
    ((suratRows ?? []) as { id: number; total_ayat: number }[]).map(s => [s.id, s.total_ayat]),
  )
  const cekAyat = (surat: number | null, ayat: number | null, label: string) => {
    if (!surat || !ayat) return null
    const maks = panjang.get(surat)
    if (maks && ayat > maks) return `${label}: surat itu hanya sampai ayat ${maks}.`
    return null
  }
  const salahTahsin = cekAyat(tahsinSurat, tahsinAyat, 'Tahsin')
  if (salahTahsin) return { error: salahTahsin }
  const salahTahfidz = cekAyat(tahfidzSurat, tahfidzAyat, 'Tahfidz')
  if (salahTahfidz) return { error: salahTahfidz }

  // Posisi terakhir yang tercatat sebelum periode ini.
  const { data: sebelum } = await supabase
    .from('gukar_monthly')
    .select('jilid_id, halaman, tahsin_surat, tahsin_ayat, tahfidz_surat, tahfidz_ayat')
    .eq('participant_id', participantId)
    .lt('period', toPeriodDate(periodKey))
    .order('period', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lalu = (sebelum ?? null) as {
    jilid_id: string | null; halaman: number | null
    tahsin_surat: number | null; tahsin_ayat: number | null
    tahfidz_surat: number | null; tahfidz_ayat: number | null
  } | null

  /*
    KUNCI SURAT PADA TAHAP AL-QUR'AN.

    Surat yang sudah dimulai harus ditamatkan dulu. Tanpa aturan ini, bagian
    yang ditinggalkan di tengah tidak pernah tercatat selesai oleh siapa pun —
    dan tidak ada apa pun di sistem ini yang akan menagihnya kemudian.
  */
  if (tahap?.is_quran && tahsinSurat) {
    const kunci = suratTahsinTersedia(
      { surat: lalu?.tahsin_surat ?? null, ayat: lalu?.tahsin_ayat ?? null },
      s => panjang.get(s) ?? null,
    )
    if (kunci.terkunci && tahsinSurat !== kunci.suratWajib) {
      return {
        error: 'Surat sebelumnya belum tamat — selesaikan dulu sebelum pindah surat.',
      }
    }
    if (!kunci.terkunci && tahsinSurat < kunci.mulaiDari) {
      return { error: `Surat itu sudah terlewati. Mulai dari surat ke-${kunci.mulaiDari}.` }
    }
  }

  const posisiKini = { jilidId, halaman, surat: tahsinSurat, ayat: tahsinAyat }
  const posisiLalu = lalu
    ? { jilidId: lalu.jilid_id, halaman: lalu.halaman, surat: lalu.tahsin_surat, ayat: lalu.tahsin_ayat }
    : null

  return {
    tahap_turunan: tahap ? tahapTahsinDari(namaMetode, tahap.label, tahap.is_quran) : '',
    jilid_id: jilidId,
    halaman,
    tahsin_surat: tahsinSurat,
    tahsin_ayat: tahsinAyat,
    tahfidz_surat: tahfidzSurat,
    tahfidz_ayat: tahfidzAyat,
    setoran_tahsin_halaman: setoranTahsinBulanIni(tahapan, posisiKini, posisiLalu),
    setoran_tahfidz_halaman: setoranTahfidzBulanIni(
      { surat: tahfidzSurat, ayat: tahfidzAyat },
      lalu ? { surat: lalu.tahfidz_surat, ayat: lalu.tahfidz_ayat } : null,
    ),
  }
}
