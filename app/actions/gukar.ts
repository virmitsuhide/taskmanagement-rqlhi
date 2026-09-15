'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { bolehMengampuGukar } from '@/lib/data/gukar'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getSession } from '@/lib/auth/session'
import { canManageGukar, canManageGukarSetoran } from '@/lib/auth/permissions'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'
import { STANDAR_BY_KEY, TAHAP_TAHSIN, tahapTahsinDari } from '@/lib/rq/gukar-standar'
import {
  setoranTahsinBulanIni, setoranTahfidzBulanIni, suratTahsinTersedia, type TahapJilid,
} from '@/lib/rq/gukar-setoran'
import type { GukarStatusPegawai } from '@/types'

type Result = { error?: string; success?: boolean }

/**
 * Angka dari form, atau NULL bila dikosongkan.
 *
 * Kosong dan nol berbeda artinya di sini: "0 juz tuntas" adalah pengukuran,
 * sedangkan kolom kosong berarti belum diukur — dan analitik memperlakukan
 * keduanya berbeda saat menghitung cakupan data.
 */
function angkaAtauNull(nilai: FormDataEntryValue | null, min: number, max: number): number | null {
  const teks = String(nilai ?? '').trim()
  if (!teks) return null
  const angka = Number(teks)
  if (!Number.isFinite(angka)) return null
  return Math.min(max, Math.max(min, Math.round(angka)))
}

/**
 * Pengisian capaian pembinaan dilakukan pengampu lewat portal /guru.
 *
 * Izinnya tidak ditentukan role melainkan PENUGASAN: yang boleh mengisi hanya
 * guru yang tercatat sebagai pengampu kelompok itu. Diperiksa ke database tiap
 * kali, bukan dititipkan lewat form — id kelompok datang dari peramban dan
 * karenanya tidak boleh dipercaya.
 */
async function guardPengampu(
  groupId: string,
): Promise<{ teacherId: string | null; groupId: string } | { error: string }> {
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
    return { teacherId: teacher.teacherId, groupId }
  }

  // Jalur kedua: SDM sebagai pemilik program, dan Kepala RQ. Keduanya masuk
  // lewat akun pengurus, bukan akun guru, sehingga sesinya berbeda jenis.
  // recorded_by dibiarkan null — kolom itu merujuk tabel teachers, dan
  // pengurus yang mengoreksi belum tentu punya baris di sana.
  const pengurus = await getSession()
  if (pengurus && canManageGukarSetoran(pengurus.role)) {
    return { teacherId: null, groupId }
  }

  return { error: 'Sesi tidak valid atau tidak memiliki izin.' }
}

/**
 * Simpan catatan satu peserta pada satu bulan.
 *
 * Memakai upsert pada (participant_id, period): pengampu lazimnya membuka
 * bulan yang sama berkali-kali — menandai kehadiran pekan ini, lalu menambah
 * capaian di akhir bulan — dan tiap kali menyimpan harus memperbarui baris
 * yang sama, bukan menumpuk baris baru.
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
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id, metode_id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  /*
    METODE DIKUNCI DI SERVER, BUKAN HANYA DI FORM.

    Formulir memang menonaktifkan pilihan metode begitu terisi, tapi select
    yang dinonaktifkan hanya menghentikan orang yang memakai formulirnya.
    Nilai baru hanya diterima bila kolomnya memang masih kosong; sesudah itu
    kiriman apa pun yang berbeda ditolak, bukan diam-diam diabaikan —
    pengampu perlu tahu kalau ia sedang mencoba hal yang tidak diizinkan.
  */
  const metodeDiminta = ((formData.get('metode_id') as string) ?? '').trim() || null
  const metodeTerkunci = (participant as { metode_id: string | null }).metode_id
  if (metodeTerkunci && metodeDiminta && metodeDiminta !== metodeTerkunci) {
    return { error: 'Metode tahsin sudah ditetapkan dan tidak bisa diganti.' }
  }
  const metodeId = metodeTerkunci ?? metodeDiminta
  if (!metodeTerkunci && metodeId) {
    await supabase.from('gukar_participants').update({ metode_id: metodeId }).eq('id', participantId)
  }

  const isi = await bacaSetoran(supabase, formData, participantId, periodKey, metodeId)
  if ('error' in isi) return isi

  // tahap_turunan hanya jembatan ke kolom tahap_tahsin di bawah; ia bukan
  // kolom tabel, jadi dikeluarkan sebelum baris ditulis.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tahap_turunan: _turunan, ...kolomDb } = isi
  const halaman = Number((formData.get('jumlah_halaman') as string) ?? '0')

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
  const tahap = isi.tahap_turunan || tahapKiriman

  const juzTuntas = angkaAtauNull(formData.get('juz_tuntas'), 0, 30)
  const juzBerjalan = angkaAtauNull(formData.get('juz_berjalan'), 1, 30)
  const nilaiTahfidz = angkaAtauNull(formData.get('nilai_tahfidz'), 0, 100)
  const suratPilihan = angkaAtauNull(formData.get('surat_pilihan'), 0, 30) ?? 0

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      capaian_tahsin: ((formData.get('capaian_tahsin') as string) ?? '').trim(),
      capaian_tahfidz: ((formData.get('capaian_tahfidz') as string) ?? '').trim(),
      tahap_tahsin: tahap,
      juz_tuntas: juzTuntas,
      juz_berjalan: juzBerjalan,
      nilai_tahfidz: nilaiTahfidz,
      surat_pilihan: suratPilihan,
      hadir_1: formData.get('hadir_1') === 'on',
      hadir_2: formData.get('hadir_2') === 'on',
      hadir_3: formData.get('hadir_3') === 'on',
      hadir_4: formData.get('hadir_4') === 'on',
      hadir_5: formData.get('hadir_5') === 'on',
      jumlah_halaman: Number.isFinite(halaman) && halaman > 0 ? Math.round(halaman) : 0,
      ...kolomDb,
      catatan: ((formData.get('catatan') as string) ?? '').trim(),
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan catatan.' }

  revalidatePath(`/guru/gukar/${groupId}`)
  return { success: true }
}

/**
 * Tandai kehadiran satu pekan tanpa membuka formulir.
 *
 * Pembinaan berjalan sepekan sekali, jadi tindakan yang paling sering
 * dilakukan pengampu adalah mencentang hadir untuk pekan berjalan. Aksi
 * ringkas ini membuatnya cukup satu klik alih-alih membuka dan menyimpan
 * seluruh formulir peserta.
 */
export async function toggleHadirAction(
  groupId: string,
  participantId: string,
  periodKey: string,
  pekan: number,
  hadir: boolean,
): Promise<Result> {
  const auth = await guardPengampu(groupId)
  if ('error' in auth) return auth
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (!Number.isInteger(pekan) || pekan < 1 || pekan > 5) return { error: 'Pekan tidak valid.' }

  const supabase = createServerClient()
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const { error } = await supabase.from('gukar_monthly').upsert(
    {
      participant_id: participantId,
      period: toPeriodDate(periodKey),
      [`hadir_${pekan}`]: hadir,
      recorded_by: auth.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'participant_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan kehadiran.' }

  revalidatePath(`/guru/gukar/${groupId}`)
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
  const { data: participant } = await supabase
    .from('gukar_participants')
    .select('id')
    .eq('id', participantId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!participant) return { error: 'Peserta bukan anggota kelompok ini.' }

  const { error } = await supabase
    .from('gukar_monthly')
    .delete()
    .eq('participant_id', participantId)
    .eq('period', toPeriodDate(periodKey))

  if (error) return { error: error.message || 'Gagal menghapus catatan.' }

  revalidatePath(`/guru/gukar/${groupId}`)
  revalidatePath('/dashboard/analitik/gukar')
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

/**
 * Baca posisi tahsin & tahfidz dari form, tegakkan aturannya, lalu hitung
 * jarak yang ditempuh bulan ini.
 *
 * SEMUA ATURAN DITEGAKKAN DI SINI, BUKAN DI FORMULIR
 *
 * Formulir sudah menuntun — dropdown halaman terbatas, pilihan surat dikunci
 * saat suratnya belum tamat. Tapi tuntunan bukan penjagaan: FormData bisa
 * disusun siapa saja. Yang membuat data tetap masuk akal adalah pemeriksaan
 * di fungsi ini, dan CHECK di migrasi 0061 sebagai jaring terakhirnya.
 *
 * Jarak dihitung dari catatan TERAKHIR sebelum periode ini — bukan dari bulan
 * kalender sebelumnya. Pembinaan bisa bolong sebulan, dan halaman yang
 * ditempuh selama itu tetap halaman yang ditempuh.
 */
async function bacaSetoran(
  supabase: ReturnType<typeof createServerClient>,
  formData: FormData,
  participantId: string,
  periodKey: string,
  metodeId: string | null,
): Promise<KolomSetoran | { error: string }> {
  const jilidId = ((formData.get('jilid_id') as string) ?? '').trim() || null
  const halaman = angkaAtauNull(formData.get('halaman'), 1, 999)
  const tahsinSurat = angkaAtauNull(formData.get('tahsin_surat'), 1, 114)
  const tahsinAyat = angkaAtauNull(formData.get('tahsin_ayat'), 1, 300)
  const tahfidzSurat = angkaAtauNull(formData.get('tahfidz_surat'), 1, 114)
  const tahfidzAyat = angkaAtauNull(formData.get('tahfidz_ayat'), 1, 300)

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
