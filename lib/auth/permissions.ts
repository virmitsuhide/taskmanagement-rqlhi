import { getProgramsForJenjang, isQulsSdProgram, QULS_SD_PROGRAMS } from '@/lib/rq/programs'
import type {
  UserRole, MeetingType, AgendaTag, TaskStatus, TaskPriority, TaskWeight,
  TaskProblemType, PublicTarget, Jenjang, TeacherEmployment, UjianUnit,
  LingkupPenugasan, KategoriGuru,
} from '@/types'

// Dashboard access matrix.
// Isolasi penuh: tiap role hanya boleh membuka dashboard-nya sendiri.
// Kepala RQ punya dashboard manajemen khusus (berisi task lintas divisi timnya).
// Bendahara & New Squad memakai dashboard "pribadi" ringkas.
const DASHBOARD_ACCESS: Record<string, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  sdm: ['sdm'],
  'koor-sd': ['koor_sd'],
  'koor-smp': ['koor_smp'],
  'koor-qulssd': ['koor_qulssd'],
  'koor-tpait': ['koor_tpait'],
  'koor-sdjuara': ['koor_sdjuara'],
  'koor-sma': ['koor_sma'],
  'koor-ekstra': ['koor_ekstra'],
  humas: ['humas'],
  'div-training': ['div_training'],
  pribadi: ['bendahara', 'new_squad', 'div_quran_bpa', 'div_quran_bpi'],
  admin: ['admin'],
}

export function canViewDashboard(role: UserRole, dashboardSlug: string): boolean {
  return DASHBOARD_ACCESS[dashboardSlug]?.includes(role) ?? false
}

export function getAccessibleDashboards(role: UserRole): string[] {
  return Object.entries(DASHBOARD_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([slug]) => slug)
}

// Meeting permissions
const MEETING_CREATE: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  // BPA & BPI ikut membuat supaya giliran menulis notulen bisa berpindah.
  koor_x_boarding: ['koor_smp', 'div_quran_bpa', 'div_quran_bpi'],
  rq_x_quls: ['kumik'],
  humas_yayasan: ['humas'],
  tahsin_rekomendasi: ['koor_sd'],
  quls_sd: ['koor_qulssd'],
  koor_tpait: ['koor_tpait'],
  koor_sdjuara: ['koor_sdjuara'],
  koor_sma: ['koor_sma'],
}

const MEETING_EDIT: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kumik', 'koor_sd', 'koor_smp', 'koor_tpait', 'koor_sdjuara', 'koor_sma', 'koor_ekstra'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  // Notulis berhak membetulkan tulisannya sendiri; membuang rapat tidak
  // ikut diberikan — itu tetap di koor SMP & Kepala RQ.
  koor_x_boarding: ['koor_smp', 'div_quran_bpa', 'div_quran_bpi'],
  rq_x_quls: ['kumik'],
  humas_yayasan: ['humas'],
  tahsin_rekomendasi: ['koor_sd'],
  quls_sd: ['koor_qulssd'],
  koor_tpait: ['koor_tpait'],
  koor_sdjuara: ['koor_sdjuara'],
  koor_sma: ['koor_sma'],
}

const MEETING_DELETE: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq'],
  kumik: ['kumik'],
  new_squad: ['sdm'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_x_sd: ['koor_sd'],
  koor_x_smp: ['koor_smp'],
  koor_x_boarding: ['koor_smp'],
  rq_x_quls: ['kumik'],
  humas_yayasan: ['humas'],
  tahsin_rekomendasi: ['koor_sd'],
  quls_sd: ['koor_qulssd'],
  koor_tpait: ['koor_tpait'],
  koor_sdjuara: ['koor_sdjuara'],
  koor_sma: ['koor_sma'],
}

const MEETING_VIEW: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_tpait', 'koor_sdjuara', 'koor_sma', 'koor_ekstra', 'koor_qulssd'],
  // Para koor & Humas ikut memantau notulen New Squad — kecuali tiga koor unit
  // 0099 (TPAIT, SD Juara, SMA), yang tidak terlibat urusan New Squad.
  new_squad: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'div_training', 'new_squad', 'koor_sd', 'koor_smp', 'koor_ekstra', 'koor_qulssd', 'humas'],
  // Koor QULS SD ikut membaca: kelompoknya duduk di sesi & unit yang sama,
  // jadi keputusan rapat koor SD kerap menyangkut anak-anaknya juga.
  koor_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_qulssd'],
  koor_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  koor_x_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_boarding: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp', 'div_quran_bpa', 'div_quran_bpi'],
  // Rapat RQ x QULS dibatasi — koor & divisi lain tidak melihatnya. Koor QULS
  // SD dikecualikan sejak jabatannya ada: dialah yang menjalankan hasil rapat
  // ini di lapangan, dan sebelumnya ia hanya bisa mendengarnya dari orang lain.
  rq_x_quls: ['kumik', 'kepala_rq', 'sdm', 'bendahara', 'koor_qulssd'],
  // Rapat Humas dengan Yayasan — dipegang Humas, dipantau manajemen.
  humas_yayasan: ['humas', 'kepala_rq', 'kumik', 'sdm', 'bendahara'],
  // Rapat Tahsin Rekomendasi — dipegang koor SD, dipantau manajemen. Koor SMP
  // sengaja di luar: rekomendasi tahsin di sini menyangkut siswa SD saja.
  tahsin_rekomendasi: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  // Rapat internal guru QULS SD. Koor SD sengaja di luar: arah bacanya memang
  // satu arah — koor QULS SD membaca notulen koor SD karena kelompoknya duduk
  // di sesi & unit yang sama, tapi forum pembinaan tim sendiri tidak dibuka,
  // sama seperti rapat koor SMP yang tertutup bagi koor SD.
  quls_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_qulssd'],
  // Rapat internal tiga koor unit baru (0099) — dipantau manajemen, sama
  // seperti rapat koor SD & SMP.
  koor_tpait: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_tpait'],
  koor_sdjuara: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sdjuara'],
  koor_sma: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sma'],
}

export function canCreateMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_CREATE[type]?.includes(role) ?? false
}

export function canEditMeeting(role: UserRole, type: MeetingType): boolean {
  if (role === 'kepala_rq') return true // Kepala RQ: kelola semua rapat
  return MEETING_EDIT[type]?.includes(role) ?? false
}

export function canDeleteMeeting(role: UserRole, type: MeetingType): boolean {
  if (role === 'kepala_rq') return true // Kepala RQ: kelola semua rapat
  return MEETING_DELETE[type]?.includes(role) ?? false
}

/**
 * Siapa yang boleh membuka keranjang sampah rapat: memulihkan yang terbuang,
 * dan menghapusnya untuk selamanya.
 *
 * Sengaja hanya Kepala RQ, dan sengaja BUKAN turunan dari canDeleteMeeting.
 * Membuang ke keranjang itu bisa dibatalkan, jadi wajar dipegang tiap
 * koordinator atas rapatnya sendiri. Mengosongkan keranjang tidak bisa
 * dibatalkan, jadi ia berhenti di satu orang — dan orang itu melihat seluruh
 * isi keranjang lintas jenis rapat sebelum memutuskan.
 */
export function canPurgeMeeting(role: UserRole): boolean {
  return role === 'kepala_rq'
}

export function canViewMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_VIEW[type]?.includes(role) ?? false
}

export function getViewableMeetingTypes(role: UserRole): MeetingType[] {
  return (Object.entries(MEETING_VIEW) as [MeetingType, UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([type]) => type)
}

// ─── Papan Rapat (0077) ──────────────────────────────────────────────────────
// Yang melihat papan = yang boleh membaca notulennya (canViewMeeting per jenis).

/**
 * Boleh membuka Papan Rapat. Tiga koor unit 0099 (TPAIT, SD Juara, SMA)
 * tidak: mereka cukup membaca notulen di Rapat & Notulen.
 */
export function canViewPapanRapat(role: UserRole): boolean {
  return role !== 'koor_tpait' && role !== 'koor_sdjuara' && role !== 'koor_sma'
    && getViewableMeetingTypes(role).length > 0
}

/** Menyetujui / menolak poin Approval. Keputusan anggaran & SDM ada di Kepala RQ. */
export function canDecideRapatApproval(role: UserRole): boolean {
  return role === 'kepala_rq'
}

/** Mengisi biaya approval yang disetujui — tugas bendahara. */
export function canIsiBiayaRapat(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Menandai diskusi selesai & mengeluarkan poin dari papan aktif — sama dengan penyunting notulennya. */
export function canKelolaPapanRapat(role: UserRole, type: MeetingType): boolean {
  return canEditMeeting(role, type)
}

/**
 * Jenis rapat yang boleh DIBUAT peran ini.
 *
 * Dipakai dashboard untuk memilih rapat mana yang ditampilkan di "Rapat
 * Terbaru". Diturunkan dari MEETING_CREATE, tidak ditulis ulang di tiap
 * halaman: daftar yang disalin harus diingat saat jenis rapat baru lahir, dan
 * itu tidak terjadi. Migrasi 0012 menambah koor_x_sd, koor_x_smp,
 * koor_x_boarding, dan rq_x_quls; keempat dashboard koor tetap memegang daftar
 * lamanya, sehingga seorang koor SMP yang membuat Rapat Koor x SMP tidak
 * menemukannya di dashboardnya sendiri — yang tampil justru rapat kumik.
 *
 * Gagalnya diam-diam: tidak ada galat, hanya rapat yang tidak pernah muncul.
 */
export function getCreatableMeetingTypes(role: UserRole): MeetingType[] {
  return (Object.entries(MEETING_CREATE) as [MeetingType, UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([type]) => type)
}

// Task assignment — who can assign to whom
/**
 * Boleh membuka modul Tugas: daftar, papan kanban, Gantt, dan Tugas Rutin.
 *
 * Yang dicatat di sini justru pengecualiannya, sebab hampir semua pengurus
 * memilikinya. Div Quran BPA & BPI diangkat untuk satu urusan: pembinaan
 * Quran santri asrama, lewat pengajuan ujian dan rapat Koor x Boarding.
 * Papan tugas lintas divisi bukan bagian dari amanah itu.
 *
 * Menu Tugas, Papan Tugas, dan Tugas Rutin di sidebar TIDAK dijaga izin apa
 * pun sebelum ini: ketiganya tampil untuk siapa saja yang berhasil login.
 * Jadi tanpa fungsi ini, membatasi peran baru cuma berarti menyembunyikan
 * tautannya, sementara alamatnya tetap terbuka bagi yang mengetiknya langsung.
 */
// Tiga koor unit 0099 (TPAIT, SD Juara, SMA) juga tanpa modul tugas — amanahnya
// pembinaan Qur'an unit: siswa, halaqoh, ujian, dan rapat.
const TANPA_MODUL_TUGAS: UserRole[] = ['div_quran_bpa', 'div_quran_bpi', 'admin', 'koor_tpait', 'koor_sdjuara', 'koor_sma']

export function canViewTasks(role: UserRole): boolean {
  return !TANPA_MODUL_TUGAS.includes(role)
}

/**
 * Boleh membuka papan tugas rutin seluruh pengurus.
 *
 * Kepala RQ saja, dan pembatasan ini lebih ketat daripada papan tugas biasa
 * (getBoardDivisions, yang juga terbuka untuk kumik & SDM) karena isinya
 * berbeda sifat. Papan tugas berisi pekerjaan yang ditugaskan dan memang
 * dimaksudkan untuk dikoordinasi ramai-ramai. Tugas rutin disusun sendiri
 * oleh tiap pengurus — termasuk alasan pribadi kenapa sesuatu tidak sempat
 * dikerjakan pekan ini — dan membukanya ke sesama pengurus akan mengubah
 * sifat kolom alasan itu: orang berhenti menulis sebab yang sebenarnya
 * begitu tahu rekan sejawatnya ikut membaca.
 *
 * Kepala RQ adalah pengecualiannya karena dialah yang menilai amanah.
 */
export function canViewRoutineBoard(role: UserRole): boolean {
  return role === 'kepala_rq'
}

const TASK_ASSIGN_TO: Record<UserRole, UserRole[]> = {
  kepala_rq: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'koor_qulssd', 'humas', 'div_training', 'new_squad'],
  kumik: ['koor_sd', 'koor_smp', 'koor_qulssd', 'koor_ekstra', 'humas', 'bendahara'],
  sdm: ['new_squad', 'div_training', 'humas', 'bendahara'],
  // Para koor menugasi divisinya sendiri, plus Humas. Humas ikut karena keempat
  // koor memang sudah memantau papan Humas (getBoardDivisions di bawah) — tanpa
  // ini mereka melihat antrean desain & publikasi yang mereka butuhkan tapi
  // harus menitipkannya lewat kumik untuk mengisinya.
  koor_sd: ['koor_sd', 'humas'],
  koor_smp: ['koor_smp', 'humas'],
  koor_qulssd: ['koor_qulssd', 'humas'],
  // Tiga koor unit 0099 tidak memegang modul tugas (TANPA_MODUL_TUGAS):
  // tidak menugasi dan tidak ditugasi.
  koor_tpait: [],
  koor_sdjuara: [],
  koor_sma: [],
  koor_ekstra: ['humas'],
  bendahara: [],
  humas: [],
  div_training: [],
  new_squad: [],
  // Modul tugas tidak diberikan ke BPA & BPI, jadi tidak ada yang bisa
  // mereka tugasi — dan tidak ada yang boleh menugasi mereka.
  div_quran_bpa: [],
  div_quran_bpi: [],
  // Admin bukan jabatan: tidak menugasi dan tidak ditugasi.
  admin: [],
}

export function canAssignTask(role: UserRole, targetRole: UserRole): boolean {
  return TASK_ASSIGN_TO[role]?.includes(targetRole) ?? false
}

export function getAssignableRoles(role: UserRole): UserRole[] {
  return TASK_ASSIGN_TO[role] ?? []
}

export function canAssignAnyTask(role: UserRole): boolean {
  return (TASK_ASSIGN_TO[role]?.length ?? 0) > 0
}

// Kanban board — divisi mana yang bisa user lihat di papan.
// Divisi sebuah task = role penerima (assignee).
const ALL_ROLES: UserRole[] = [
  'kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_qulssd',
  'koor_ekstra', 'humas', 'div_training', 'new_squad',
]

/**
 * Jabatan koordinator yang papan tugasnya saling terbuka. Tiga koor unit
 * 0099 (TPAIT, SD Juara, SMA) di luar: mereka tanpa modul tugas.
 */
const KOOR_PAPAN: UserRole[] = ['koor_sd', 'koor_smp', 'koor_qulssd', 'koor_ekstra']

export function getBoardDivisions(role: UserRole): UserRole[] {
  if (!canViewTasks(role)) return []
  if (role === 'kepala_rq' || role === 'kumik' || role === 'sdm') return ALL_ROLES
  // Sesama koor saling melihat papan tugasnya, plus New Squad & Humas.
  if (KOOR_PAPAN.includes(role)) return [...KOOR_PAPAN, 'new_squad', 'humas']
  // Humas memantau papannya sendiri plus New Squad.
  if (role === 'humas') return ['humas', 'new_squad']
  return []
}

// ─── Sprint bulanan (0072) ───────────────────────────────────────────────────

/**
 * Jabatan yang sprint-nya boleh dilihat: milik sendiri, plus jabatan yang
 * papan kanbannya memang boleh dipantau. Sprint adalah ringkasan papan per
 * bulan, jadi izinnya dipinjam utuh dari sana.
 */
export function getSprintJabatan(role: UserRole): UserRole[] {
  if (!canViewTasks(role)) return []
  return [...new Set<UserRole>([role, ...getBoardDivisions(role)])]
}

/**
 * Boleh menulis goal, menyanggupi tugas, dan mengisi review sebuah jabatan.
 * Pemegang jabatan itu sendiri — dan Kepala RQ sebagai Product Owner.
 */
export function canEditSprintJabatan(role: UserRole, jabatan: UserRole): boolean {
  return role === jabatan || role === 'kepala_rq'
}

/** Mengesahkan Sprint Goal & menutup sprint: Product Owner, yaitu Kepala RQ. */
export function isProductOwner(role: UserRole): boolean {
  return role === 'kepala_rq'
}

export function canViewDivisiBoard(role: UserRole): boolean {
  return getBoardDivisions(role).length > 0
}

/**
 * Boleh membuka garis waktu (Gantt) milik pengguna lain?
 *
 * Sengaja diturunkan dari getBoardDivisions, bukan dari daftar izin baru:
 * papan kanban dan Gantt memperlihatkan kumpulan tugas yang sama persis, hanya
 * berbeda sumbu — kanban menyusunnya per status, Gantt per tanggal. Kalau
 * keduanya punya aturan sendiri-sendiri, cepat atau lambat salah satu akan
 * bocor lebih luas dari yang lain tanpa ada yang menyadarinya.
 *
 * Diri sendiri selalu boleh, termasuk untuk role yang tidak memantau divisi
 * mana pun (bendahara, div_training, new_squad) — Gantt pribadi adalah alat
 * kerja, bukan wewenang pengawasan.
 */
export function canViewUserGantt(
  viewerRole: UserRole,
  viewerId: string,
  target: { id: string; role: UserRole },
): boolean {
  if (viewerId === target.id) return true
  return getBoardDivisions(viewerRole).includes(target.role)
}

/**
 * Lapisan manajemen RQ.
 *
 * Ketiganya sudah memantau papan seluruh divisi (getBoardDivisions) dan
 * analitik agregat, jadi merekalah yang diberi tahu saat ada tugas disunting
 * atau dihapus — termasuk tugas pribadi yang pemiliknya adalah pemberi sekaligus
 * penerima, yang kalau tidak begitu tidak akan terpantau siapa pun.
 */
const MANAGEMENT_ROLES: UserRole[] = ['kepala_rq', 'kumik', 'sdm']

export function isManagement(role: UserRole): boolean {
  return MANAGEMENT_ROLES.includes(role)
}

// Analitik RQ — dashboard agregat lintas divisi/halaqoh (manajemen)
export function canViewAnalytics(role: UserRole): boolean {
  return isManagement(role)
}

/**
 * Boleh membuka Analitik per Unit. Lebih luas dari canViewAnalytics: koor SD &
 * koor SMP ikut masuk, tapi datanya dipersempit ke unit masing-masing lewat
 * getAnalyticsJenjang(). Halaman "Analitik RQ" umum (agregat seluruh RQ) tetap
 * tertutup untuk koor.
 */
export function canViewUnitAnalytics(role: UserRole): boolean {
  return canViewAnalytics(role) || isKoorAnalitik(role)
}

/**
 * Koordinator yang membuka Analitik BTHCQ — dikunci ke unitnya, tanpa pilihan
 * "Semua" dan tanpa tabel target per angkatan (sudah terwakili matriks kelas).
 *
 * Koor QULS SD ikut: halamannya sama persis dengan koor SD, hanya isinya
 * dipersempit ke anak QULS lewat getAnalyticsProgramScope().
 */
export function isKoorAnalitik(role: UserRole): boolean {
  return isKoorUnit(role) || role === 'koor_qulssd'
}

/**
 * Penyempitan program di atas getAnalyticsJenjang — null berarti tanpa
 * penyempitan. Aturannya sama dengan daftar siswa (getViewableProgramScope):
 * koor SD melihat seluruh SD termasuk QULS, koor QULS SD hanya QULS.
 */
export function getAnalyticsProgramScope(role: UserRole): readonly string[] | null {
  return getListProgramScope(role, getAnalyticsJenjang(role))
}

/**
 * Unit (jenjang) mana yang boleh dilihat di Analitik per Unit.
 *
 * Untuk koor, cakupannya sama persis dengan getManageableJenjang() — satu unit
 * saja. Bedanya di manajemen: kumik & SDM tidak mengelola jenjang apa pun tapi
 * tetap boleh melihat analitik seluruh unit.
 */
export function getAnalyticsJenjang(role: UserRole): Jenjang[] {
  if (canViewAnalytics(role)) return ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  return getManageableJenjang(role)
}

/**
 * Boleh mengubah kalender pekan efektif target tahfidz.
 *
 * Satu kalender berlaku untuk SEMUA program, jadi pemegangnya sama dengan
 * pemegang tahun ajaran — bukan koordinator unit, yang perubahannya akan
 * ikut menggeser target unit lain tanpa sepengetahuan mereka.
 */
export function canEditKalenderTahfidz(role: UserRole): boolean {
  return canManageTerms(role)
}

/** Boleh menandai siswa SMP sebagai lulusan SD LHI (target SMPIT internal). */
export function canTandaiAsalSdLhi(role: UserRole): boolean {
  return canManageStudents(role, 'smp')
}

// Task status change — who can perform which transitions
//
// Pelaksana (assignee) menggerakkan tugasnya sendiri sampai kolom Review.
// Pemberi tugas (assigner) hanya berwenang menutup review: Review → Selesai
// atau Review → dikembalikan. Kepala RQ boleh semuanya.
const ASSIGNEE_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  todo:        ['in_progress', 'problem'],
  in_progress: ['submitted', 'problem', 'todo'],
  problem:     ['in_progress', 'submitted', 'todo'],
  submitted:   ['in_progress'],           // tarik kembali sebelum direview
  returned:    ['in_progress', 'problem'],
}

const ASSIGNER_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  submitted: ['done', 'returned'],
}

export function canChangeTaskStatus(
  role: UserRole,
  currentStatus: TaskStatus,
  newStatus: TaskStatus,
  isAssignee: boolean,
  isAssigner: boolean
): boolean {
  if (role === 'kepala_rq') return true
  if (isAssignee && ASSIGNEE_TRANSITIONS[currentStatus]?.includes(newStatus)) return true
  if (isAssigner && ASSIGNER_TRANSITIONS[currentStatus]?.includes(newStatus)) return true
  return false
}

/**
 * Boleh menyeret kartu di papan kanban? Hanya orang yang bersangkutan
 * (pelaksana atau pemberi tugas) dan Kepala RQ. Ini gerbang UI — server tetap
 * memvalidasi transisinya lewat canChangeTaskStatus.
 */
export function canMoveTaskOnBoard(role: UserRole, isAssignee: boolean, isAssigner: boolean): boolean {
  return role === 'kepala_rq' || isAssignee || isAssigner
}

/**
 * Boleh menambah, menyunting, atau menghapus rincian (sub-tugas) sebuah tugas?
 *
 * Sengaja sama persis dengan izin menggeser kartu di papan. Merinci tugas
 * adalah cara pelaksana mengatur pekerjaannya sendiri, dan pemberi tugas perlu
 * bisa ikut memecahnya saat mendelegasikan. Orang lain yang kebetulan bisa
 * MELIHAT tugas ini di papan divisi atau di Gantt bawahannya tetap tidak boleh
 * mengubah rencana kerja orang lain — melihat dan menyunting dua hal berbeda.
 */
export function canManageSubtasks(role: UserRole, isAssignee: boolean, isAssigner: boolean): boolean {
  return canMoveTaskOnBoard(role, isAssignee, isAssigner)
}

/**
 * Boleh menghapus tugas?
 *
 * Catatan penting soal `isAssigner`: pada tugas untuk diri sendiri, assigned_by
 * dan assigned_to berisi orang yang sama, sehingga satu bendera ini sekaligus
 * mencakup dua aturan yang diminta — "pemberi tugas boleh menghapus tugas yang
 * ia delegasikan" dan "setiap pengurus boleh menghapus tugasnya sendiri".
 * Pelaksana yang menerima delegasi orang lain sengaja TIDAK bisa menghapus:
 * ia tidak boleh menghilangkan tugas yang dibebankan kepadanya.
 */
export function canDeleteTask(
  role: UserRole,
  isAssignee: boolean,
  isAssigner: boolean,
): boolean {
  if (role === 'kepala_rq') return true
  void isAssignee
  return isAssigner
}

/**
 * Boleh menyunting isi tugas (judul, deskripsi, prioritas, bobot, tenggat)?
 *
 * Lebih sempit daripada hak menghapus: hanya tugas untuk diri sendiri, yaitu
 * saat pemberi dan penerimanya orang yang sama. Tugas hasil delegasi tidak
 * bisa disunting sepihak oleh pemberinya — mengubah isi tugas yang sudah
 * dikerjakan orang lain menggeser kesepakatan tanpa jejak persetujuan.
 */
export function canEditTask(
  role: UserRole,
  isAssignee: boolean,
  isAssigner: boolean,
): boolean {
  if (role === 'kepala_rq') return true
  return isAssignee && isAssigner
}

/** Task yang menunggu review orang ini (antrean review pemberi tugas). */
export function isAwaitingMyReview(
  task: { status: TaskStatus; assigned_by: string },
  userId: string,
  role: UserRole
): boolean {
  if (task.status !== 'submitted') return false
  return task.assigned_by === userId || role === 'kepala_rq'
}

// Home publik post permissions
//
// Kepala RQ sengaja tidak termasuk (2026-09): Home Publik dilepas dari
// Kepala RQ bersama Program RQ, Kelola Beranda, dan modul keuangan.
//
// Tiap jenis post dipetakan ke sasaran yang boleh dipilih peran itu:
// 'all' = bebas memilih Semua/SD/SMP; 'sd'/'smp' = terkunci ke unit itu.
// Koor SD & SMP memposting pengumuman dan tugas guru untuk unitnya saja.
// Koor unit lain (TPAIT, SD Juara, SMA) tidak — beranda publik baru memuat
// sasaran SD & SMP.
const PENGUMUMAN_TARGET: Partial<Record<UserRole, PublicTarget>> = {
  sdm: 'all',
  bendahara: 'all',
  koor_sd: 'sd',
  koor_smp: 'smp',
}
const TUGAS_GURU_TARGET: Partial<Record<UserRole, PublicTarget>> = {
  koor_sd: 'sd',
  koor_smp: 'smp',
}

export function canPostToHome(role: UserRole): boolean {
  return canPostPengumuman(role) !== null || canPostTugasGuru(role) !== null
}

/** Sasaran pengumuman peran ini — 'all' bebas memilih, null tidak boleh. */
export function canPostPengumuman(role: UserRole): PublicTarget | null {
  return PENGUMUMAN_TARGET[role] ?? null
}

/** Sasaran tugas guru peran ini — 'all' bebas memilih, null tidak boleh. */
export function canPostTugasGuru(role: UserRole): PublicTarget | null {
  return TUGAS_GURU_TARGET[role] ?? null
}

// Humas request
//
// Humas adalah penerima request, bukan pemohon — dia tidak request ke dirinya
// sendiri. Jadi humas tidak boleh membuat request, tapi tetap harus bisa
// membuka daftarnya untuk memproses request yang masuk.
export function canRequestToHumas(role: UserRole): boolean {
  // Daftar-tolak, bukan daftar-izin: hampir semua divisi memang memesan
  // publikasi ke Humas. Konsekuensinya tiap peran baru lolos secara default,
  // dan itulah yang terjadi pada Div Quran BPA & BPI sampai baris ini ada.
  //
  // Humas melayani publikasi RQ LHI; pembinaan Quran santri asrama berjalan
  // di unit yang berbeda dan tidak memesan lewat antrean itu. Tiga koor unit
  // 0099 (TPAIT, SD Juara, SMA) juga tidak memesan ke Humas.
  return role !== 'new_squad'
    && role !== 'humas'
    && role !== 'div_quran_bpa'
    && role !== 'div_quran_bpi'
    && role !== 'koor_tpait'
    && role !== 'koor_sdjuara'
    && role !== 'koor_sma'
}


/** Siapa yang boleh membuka halaman daftar request: pemohon + humas & kepala RQ. */
export function canViewHumasRequests(role: UserRole): boolean {
  return canRequestToHumas(role) || role === 'humas' || role === 'kepala_rq'
}

// Catatan Keuangan Bendahara
//
// Buku catatan ini milik fungsi keuangan, bukan catatan pribadi per-user:
// sepenuhnya wewenang bendahara. Kepala RQ dulu ikut membaca; sejak 2026-09
// akses itu dilepas dan modul ini milik bendahara seorang.
/** Boleh menulis/mengubah/menghapus catatan keuangan. */
export function canManageFinanceNotes(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Boleh membuka & membaca catatan keuangan. */
export function canViewFinanceNotes(role: UserRole): boolean {
  return canManageFinanceNotes(role)
}

// Modul Keuangan (pencatatan → rekap → laporan BPH)
//
// Aturan aksesnya sama dengan catatan keuangan: hanya bendahara. Kepala RQ
// tidak lagi membuka modul ini (2026-09).
// Dipisah jadi fungsi sendiri supaya kelak bisa berbeda — misal saat BPH
// diberi akses baca laporan tanpa melihat transaksi satu per satu.
/** Boleh mencatat transaksi, anggaran, dana titipan, dan narasi laporan. */
export function canManageFinance(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Boleh membuka modul keuangan & laporannya. */
export function canViewFinance(role: UserRole): boolean {
  return canManageFinance(role)
}

/**
 * Kelola berita (buat, ubah, hapus) — sepenuhnya wewenang Humas.
 *
 * Kepala RQ sengaja tidak termasuk: penulisan berita digeser ke Humas. Kepala
 * RQ tetap bisa membaca berita lewat halaman publik /news yang terbuka untuk
 * semua, jadi yang hilang hanya hak menyuntingnya.
 */
export function canCreateNews(role: UserRole): boolean {
  return role === 'humas'
}

/** Kelola Program RQ — wewenang Humas (Kepala RQ dilepas 2026-09). */
export function canEditProgram(role: UserRole): boolean {
  return role === 'humas'
}

/**
 * Menu "Program RQ" di sidebar/mobile nav — hanya pengelola program.
 * Halaman /program sendiri tetap publik (dilink dari header beranda).
 */
export function canAccessProgramMenu(role: UserRole): boolean {
  return role === 'humas'
}

/**
 * Kelola "Tentang RQ" (visi, misi, sejarah) — sepenuhnya wewenang Humas.
 *
 * Kepala RQ sengaja tidak termasuk: pengelolaan halaman profil lembaga digeser
 * ke Humas, sejalan dengan berita. Yang hilang hanya hak menyuntingnya —
 * halaman /tentang tetap terbuka untuk semua, jadi Kepala RQ masih bisa
 * membacanya seperti pembaca lain.
 */
export function canEditAbout(role: UserRole): boolean {
  return role === 'humas'
}

/**
 * Kelola tampilan beranda publik: teks header/footer, seksi mana yang tampil
 * beserta urutannya, dan kurasi Profil Guru. Wewenang Humas; Kepala RQ
 * dilepas 2026-09.
 */
export function canManageHomepage(role: UserRole): boolean {
  return role === 'humas'
}

// ─── PHASE 1B — Manajemen siswa, halaqoh, ustadz ────────────────────

// ── Penyempitan berbasis program ────────────────────────────────────
//
// Sampai sini seluruh RBAC tahsin/tahfidz berpijak pada JENJANG saja: satu
// koordinator memegang satu unit, habis perkara. Koor QULS SD memecah asumsi
// itu — anaknya sejenjang penuh dengan anak koor SD (sama-sama 'sd', kelas
// yang sama, sesi yang sama), dan yang memisahkan hanya kolom `program`.
//
// Karena itu jenjang tetap menjadi saringan pertama, dan program menjadi
// saringan kedua yang HANYA MENYEMPITKAN. Tidak ada role yang mendapat
// jenjang baru lewat jalur ini.

/**
 * Arti `program` pada fungsi-fungsi di bawah — tiga keadaan, bukan dua:
 *
 *   undefined → pertanyaannya tingkat jenjang: "ada sesuatu di unit ini yang
 *               boleh saya sentuh?" Dipakai untuk memutuskan apakah menu,
 *               tombol, atau halaman ditampilkan sama sekali.
 *   null      → barisnya nyata dan programnya belum ditandai. Itu berarti
 *               reguler, bukan QULS.
 *   string    → program baris itu apa adanya.
 *
 * Membedakan undefined dari null penting: tanpa itu, tombol "Tambah Siswa"
 * milik koor QULS SD akan hilang hanya karena pertanyaannya belum menyebut
 * program apa pun.
 */
type ProgramArg = string | null | undefined

/** Program yang menjadi wewenang KELOLA sebuah role di satu jenjang. */
function programBolehDikelola(role: UserRole, jenjang: Jenjang, program: ProgramArg): boolean {
  if (program === undefined) return true
  const quls = isQulsSdProgram(jenjang, program)
  if (role === 'koor_qulssd') return quls
  if (role === 'koor_sd') return !quls
  return true
}

/**
 * Program mana yang boleh DILIHAT role ini — dipakai menyaring kueri daftar.
 *
 * `null` berarti tanpa penyempitan. Hanya koor QULS SD yang dipersempit:
 * koor SD sengaja tetap melihat seluruh SD termasuk QULS (pemantauan tanpa
 * hak ubah), sesuai keputusan pembagian wewenangnya.
 */
export function getViewableProgramScope(role: UserRole, jenjang: Jenjang): readonly string[] | null {
  if (role === 'koor_qulssd' && jenjang === 'sd') return QULS_SD_PROGRAMS
  return null
}

/**
 * Penyempitan program yang bisa dipasang sebagai SATU filter pada kueri daftar
 * lintas unit — `.in('program', …)`.
 *
 * Mengembalikan null kecuali seluruh unit yang boleh dilihat menyempit ke
 * daftar yang sama persis. Itu keadaan koor QULS SD, yang unitnya hanya SD.
 * Kalau kelak ada role yang menyempit berbeda-beda per unit, fungsi ini
 * menyerah dengan jujur alih-alih memasang filter yang salah untuk salah satu
 * unitnya — pemanggilnya lalu harus menyaring per baris.
 */
export function getListProgramScope(role: UserRole, jenjangList: Jenjang[]): readonly string[] | null {
  if (jenjangList.length === 0) return null
  const scopes = jenjangList.map(j => getViewableProgramScope(role, j))
  if (scopes.some(s => s === null)) return null
  const kunci = new Set(scopes.map(s => [...s!].sort().join('|')))
  return kunci.size === 1 ? scopes[0] : null
}

/**
 * Program yang boleh DIPILIH role ini saat membuat/menyunting siswa atau
 * halaqoh di satu jenjang. Daftar kosong berarti unit itu memang tak punya
 * program (mis. PAUD).
 */
export function getSelectableProgramCodes(role: UserRole, jenjang: Jenjang): string[] {
  return getProgramsForJenjang(jenjang)
    .map(p => p.code)
    .filter(code => programBolehDikelola(role, jenjang, code))
}

/**
 * Semua NILAI program yang boleh disentuh role ini di satu jenjang, `null`
 * termasuk — dan null di sini berarti "belum ditandai / reguler", satu pilihan
 * yang sah seperti yang lain.
 *
 * Dipakai berkas impor dan pemindahan kelompok, yang perlu tahu bukan cuma
 * "program apa yang boleh dipilih" tapi juga "boleh tidak barisnya dibiarkan
 * kosong". Koor QULS SD adalah satu-satunya yang tidak boleh: baginya kolom
 * program kosong berarti anak itu bukan miliknya.
 */
export function getManageableProgramValues(role: UserRole, jenjang: Jenjang): (string | null)[] {
  const semua: (string | null)[] = [null, ...getProgramsForJenjang(jenjang).map(p => p.code)]
  return semua.filter(v => programBolehDikelola(role, jenjang, v))
}

/**
 * Wewenang program operator dibekukan menjadi tabel biasa, agar bisa
 * menyeberang ke peramban.
 *
 * Berkas contoh impor disusun di peramban sementara pemeriksaan barisnya
 * dijalankan ulang di server; keduanya harus membaca daftar yang sama persis,
 * dan tabel inilah bentuk yang bisa dikirimkan apa adanya.
 */
export function programScopeFor(
  role: UserRole,
  jenjangList: Jenjang[],
): Partial<Record<Jenjang, (string | null)[]>> {
  const out: Partial<Record<Jenjang, (string | null)[]>> = {}
  for (const j of jenjangList) out[j] = getManageableProgramValues(role, j)
  return out
}

/**
 * Bisa manage siswa untuk jenjang tertentu (atau semua jika jenjang null).
 * - kepala_rq:   semua jenjang
 * - kumik:       semua jenjang
 * - koor_sd:     jenjang 'sd', kecuali siswa berprogram QULS
 * - koor_qulssd: jenjang 'sd', hanya siswa berprogram QULS
 * - koor_smp:    hanya jenjang 'smp'
 *
 * Kumik ikut sejak daftar siswa punya CRUD sendiri. Sebelumnya ia hanya bisa
 * melihat, sehingga tiap salah ketik nama atau kelas harus dibawa ke Kepala RQ
 * atau koor unit — padahal Kumik-lah yang paling sering menemukannya saat
 * memeriksa rekap lintas unit.
 */
export function canManageStudents(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  if (role === 'kepala_rq' || role === 'kumik') return true
  // koor_smp dan tiga koor unit 0099 (TPAIT, SD Juara, SMA): satu jenjang utuh.
  if (role === 'koor_smp' || role === 'koor_tpait' || role === 'koor_sdjuara' || role === 'koor_sma') {
    return !jenjang || jenjang === KOOR_UNIT[role]
  }
  if (role === 'koor_sd' || role === 'koor_qulssd') {
    if (!jenjang) return true
    if (jenjang !== 'sd') return false
    return programBolehDikelola(role, jenjang, program)
  }
  return false
}

/**
 * Bisa lihat list siswa (read-only). Lebih luas dari manage.
 * - kepala_rq, kumik, sdm, bendahara: lihat semua
 * - koor_sd:     seluruh SD, QULS termasuk — memantau, tanpa hak ubah
 * - koor_qulssd: hanya SD berprogram QULS
 * - koor_smp:    jenjang masing-masing
 */
export function canViewStudents(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  if (['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(role)) return true
  if (role === 'koor_sd') return !jenjang || jenjang === 'sd'
  return canManageStudents(role, jenjang, program)
}

/**
 * Bisa manage halaqoh untuk jenjang tertentu.
 * Pattern sama dengan students — termasuk pemisahan QULS SD-nya.
 */
export function canManageHalaqoh(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  return canManageStudents(role, jenjang, program)
}

export function canViewHalaqoh(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  return canViewStudents(role, jenjang, program)
}

/**
 * Tahun ajaran & pengacakan halaqoh tiap semester.
 *
 * Menetapkan semester berjalan mengubah acuan seluruh modul tahsin/tahfidz
 * sekaligus, jadi wewenangnya dipegang Kepala RQ dan Kumik saja — koordinator
 * tetap bisa membagi santri di dalam semester yang sudah ditetapkan.
 */
export function canManageTerms(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'kumik'
}

/** Boleh membuka panel tahun ajaran (baca). */
export function canViewTerms(role: UserRole): boolean {
  return canManageTerms(role) || isKoorUnit(role) || role === 'koor_qulssd' || role === 'sdm'
}

/**
 * Manage akun guru: bikin akun, reset password, deaktivasi.
 * - kepala_rq: full
 * - sdm:       full (sumber daya manusia)
 */
export function canManageTeachers(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'sdm'
}

/**
 * Mengelola profil kepegawaian & data diri guru — menu "Profil Guru".
 *
 * SDM saja. Yang disunting di sana bukan cuma data diri: unit penugasan, TMT,
 * dan jenis kepegawaian ikut di dalamnya, dan ketiganya menentukan rubrik KPI
 * mana yang dipakai serta masa kerja yang tercetak di rapor. Itu wewenang
 * kepegawaian, bukan wewenang siapa pun yang kebetulan boleh melihat daftar
 * guru.
 *
 * Guru sendiri tetap bisa melengkapi data dirinya lewat portal guru
 * (/guru/profil) — tapi hanya bagian pribadinya, tidak menyentuh ketiga kolom
 * kepegawaian di atas.
 */
/**
 * Mengelola akun & profil karyawan RQ — menu "Karyawan".
 *
 * Admin dan SDM. Sejak akun admin dipisah dari Kepala RQ (0090), urusan
 * akun dan data orang ada di admin; SDM tetap ikut karena rekam
 * kepegawaian karyawan adalah wilayahnya.
 */
export function canManageEmployees(role: UserRole): boolean {
  return role === 'admin' || role === 'sdm'
}

export function canManageTeacherProfiles(role: UserRole): boolean {
  return role === 'sdm'
}

/**
 * View list guru (read-only). Lebih luas: kumik & koor juga butuh lihat
 * untuk assign ke halaqoh.
 */
export function canViewTeachers(role: UserRole): boolean {
  return ['kepala_rq', 'sdm', 'kumik', 'koor_qulssd'].includes(role) || isKoorUnit(role)
}

/**
 * Jenjang mana yang bisa di-manage user — dipakai untuk filter UI di Siswa,
 * Halaqoh, dan Ustadz/Guru.
 *
 * Koor dibatasi ke satu unit saja: koor SD hanya SD (bukan TPAIT/PAUD atau
 * SD Juara), koor SMP hanya SMP (bukan SMA) — sama dengan cakupan analitiknya.
 */
export function getManageableJenjang(role: UserRole): Jenjang[] {
  if (role === 'kepala_rq') return ['paud', 'sd', 'sd_juara', 'smp', 'sma']
  const unit = KOOR_UNIT[role]
  if (unit) return [unit]
  // Koor QULS SD berbagi unit dengan koor SD; yang memisahkan keduanya adalah
  // program, disaring lewat canManageStudents / getViewableProgramScope.
  if (role === 'koor_qulssd') return ['sd']
  return []
}

/**
 * Koordinator yang memegang satu unit sekolah utuh, beserta jenjangnya.
 *
 * Koor QULS SD sengaja di luar: unitnya SD juga, tapi wewenangnya dipotong
 * per program, bukan per jenjang — tiap tempat yang memeriksa "koor unit"
 * akan salah kalau ia ikut masuk tanpa saringan programnya.
 */
const KOOR_UNIT: Partial<Record<UserRole, Jenjang>> = {
  koor_sd: 'sd',
  koor_smp: 'smp',
  koor_tpait: 'paud',
  koor_sdjuara: 'sd_juara',
  koor_sma: 'sma',
}

export function isKoorUnit(role: UserRole): boolean {
  return role in KOOR_UNIT
}

export const JENJANG_LABELS: Record<Jenjang, string> = {
  paud:     'PAUD',
  sd:       'SD',
  sd_juara: 'SD Juara',
  smp:      'SMP',
  sma:      'SMA',
}

/**
 * Nama satuan pendidikan selengkapnya — untuk dokumen yang keluar dari
 * lingkaran pengurus, mis. rapor KPI yang diserahkan kepada guru.
 *
 * Terpisah dari JENJANG_LABELS dan bukan penggantinya. Label pendek dipakai di
 * chip filter, kepala tabel, dan lencana, tempat "SDIT LHI" akan memaksa
 * kolomnya melebar tanpa menambah keterangan apa pun bagi pengurus yang sudah
 * tahu konteksnya. Dokumen resmi justru sebaliknya: pembacanya guru yang
 * memegang selembar kertas tanpa konteks apa-apa.
 */
export const UNIT_PENUGASAN_LABELS: Record<Jenjang, string> = {
  paud:     'TPAIT LHI',
  sd:       'SDIT LHI',
  sd_juara: 'SD LHI Juara',
  smp:      'SMPIT LHI',
  sma:      'SMA LHI',
}

/**
 * Label tab pemilih di Profil Guru — lima unit ditambah penampungan 'lain'.
 *
 * 'lain' bukan satuan pendidikan, jadi ia tidak boleh masuk ke
 * UNIT_PENUGASAN_LABELS: peta itu dipakai mencetak nama sekolah di rapor KPI
 * yang diserahkan kepada guru, dan "Lain-lain" di kop sebuah rapor tidak
 * menyebut apa pun. Yang ini semata untuk layar pengurus.
 */
export const UNIT_PROFIL_LABELS: Record<Jenjang | 'lain' | 'pengurus', string> = {
  ...UNIT_PENUGASAN_LABELS,
  lain: 'Lain-lain / lintas yayasan',
  // 'pengurus' berbeda sifat dari enam pilihan di atasnya: yang lain memilah
  // guru menurut `unit` dan saling meniadakan, sedangkan yang ini memotong
  // melintang — seorang Koor SD tetap muncul di SDIT LHI maupun di sini.
  // Lihat UnitProfil di lib/data/guru-profil.ts untuk alasan lengkapnya.
  pengurus: 'Pengurus RQ',
}

/**
 * Label lingkup penugasan (0052) — dibaca SDM di formulir & ringkasan profil.
 *
 * "Lintas unit" disebut lebih dulu daripada "yayasan" karena itulah yang
 * membedakannya dalam pekerjaan sehari-hari: yang menentukan bukan dari mana
 * gajinya, melainkan bahwa ia tidak berada di bawah satu koordinator unit.
 */
export const LINGKUP_PENUGASAN_LABELS: Record<LingkupPenugasan, string> = {
  unit:    'Satu unit sekolah',
  yayasan: 'Lain-lain — lintas unit (yayasan)',
}

/**
 * Label kategori guru (0053) — dipakai tab /ustadz dan formulir Profil Guru.
 *
 * "Musyrif/ah" ditulis dengan kedua bentuknya, sebagaimana disebut sehari-hari;
 * satu nilai enum melayani musyrif maupun musyrifah karena yang dibedakannya
 * adalah penugasan, bukan jenis kelamin.
 */
export const KATEGORI_GURU_LABELS: Record<KategoriGuru, string> = {
  guru_rq:        'Guru RQ',
  guru_quls_sd:   'Guru QULS SD',
  musyrif_smp:    'Musyrif/ah SMP',
  guru_tpait:     'Guru TPAIT',
  guru_sd_juara:  'Guru SD Juara',
  guru_sma:       'Guru SMA',
}

/**
 * Keterangan satu kalimat per kategori, untuk formulir SDM.
 *
 * Perbedaan ketiganya tidak terbaca dari namanya — "Guru RQ" dan "Guru QULS SD"
 * sama-sama bisa mengajar di kelas QULS SD yang sama — jadi yang membedakan
 * harus ikut tertulis di tempat SDM memilihnya.
 */
export const KATEGORI_GURU_KETERANGAN: Record<KategoriGuru, string> = {
  guru_rq:        'Di bawah RQ. Bisa ditugaskan ke QULS SD, QULS SMP, maupun SD Juara.',
  guru_quls_sd:   'Hanya mengajar di QULS SD, dan berada di bawah unit SD — bukan RQ.',
  musyrif_smp:    'Guru Qur’an jam asrama SMPIT LHI; mengampu halaqoh santri boarding.',
  guru_tpait:     'Guru Qur’an TPAIT LHI; di bawah Koordinator TPAIT.',
  guru_sd_juara:  'Guru Qur’an SD LHI Juara; di bawah Koordinator SD Juara.',
  guru_sma:       'Guru Qur’an SMA LHI; di bawah Koordinator SMA.',
}

/** Urutan tampil kategori — mengikuti besarnya rombongan, bukan abjad. */
export const KATEGORI_GURU_ORDER: KategoriGuru[] = [
  'guru_rq', 'guru_quls_sd', 'musyrif_smp', 'guru_tpait', 'guru_sd_juara', 'guru_sma',
]

/**
 * Unit yang tersirat dari sebuah kategori. Buat KPI dan Setoran Guru menyaring
 * guru menurut `unit`, bukan kategori — tanpa peta ini, SDM yang memilih
 * "Guru SD Juara" di halaman Ustadz mengira gurunya sudah masuk tab SD Juara,
 * padahal unitnya masih kosong. Hanya tiga kategori unit (0102); Guru RQ,
 * Guru QULS SD, dan Musyrif/ah SMP tidak otomatis masuk daftar KPI unit.
 */
export const KATEGORI_GURU_UNIT: Partial<Record<KategoriGuru, Jenjang>> = {
  guru_tpait: 'paud',
  guru_sd_juara: 'sd_juara',
  guru_sma: 'sma',
}

/**
 * Punya profil pengurus lengkap (data diri, pendidikan, kompetensi, riwayat).
 * New Squad dikecualikan — mereka hanya punya pengaturan akun dasar.
 */
export function canHavePengurusProfile(role: UserRole): boolean {
  return role !== 'new_squad' && role !== 'admin'
}

/**
 * Nama sapaan untuk header: "Ust. Habib" / "Usth. Aul".
 * Jatuh kembali ke display_name kalau profil belum diisi.
 */
export function sapaanName(
  sapaan: string | null | undefined,
  nickname: string | null | undefined,
  displayName: string,
): string {
  const name = nickname?.trim() || displayName
  if (sapaan === 'ust') return `Ust. ${name}`
  if (sapaan === 'usth') return `Usth. ${name}`
  return name
}

// Display labels
export const ROLE_LABELS: Record<UserRole, string> = {
  kepala_rq: 'Kepala RQ',
  kumik: 'Kumik',
  sdm: 'SDM',
  bendahara: 'Bendahara',
  koor_ekstra: 'Koor Ekstra',
  koor_sd: 'Koor SD',
  koor_smp: 'Koor SMP',
  koor_qulssd: 'Koor QULS SD',
  koor_tpait: 'Koor TPAIT',
  koor_sdjuara: 'Koor SD Juara',
  koor_sma: 'Koor SMA',
  humas: 'Humas',
  div_training: 'Div Training',
  new_squad: 'New Squad',
  div_quran_bpa: 'Div Qur’an BPA',
  div_quran_bpi: 'Div Qur’an BPI',
  admin: 'Admin',
}

/**
 * Nama resmi tiap jabatan pengurus — dipakai sebagai "Amanah Saat Ini".
 *
 * Diturunkan dari role, bukan diketik pengurus. Amanah adalah kursi yang
 * ditetapkan kepala RQ lewat /pengurus, jadi membiarkannya sebagai teks bebas
 * berarti dua orang di kursi yang sama bisa menulis nama jabatan yang berbeda —
 * dan itu persis yang terjadi sebelum ini: dari 11 akun, 4 terisi dengan gaya
 * penulisan yang tidak seragam dan 7 dibiarkan kosong.
 *
 * Bedanya dengan ROLE_LABELS: yang itu label pendek untuk lencana & tabel
 * ("Koor SD"), yang ini nama utuh untuk dokumen & profil.
 */
export const AMANAH_LABELS: Record<UserRole, string> = {
  kepala_rq:   "Kepala Rumah Qur’an",
  kumik:       "Kurikulum & Metodologi (Kumik)",
  sdm:         "Kadiv SDM RQ LHI",
  bendahara:   "Bendahara",
  koor_sd:     "Koordinator Qur’an unit SD",
  koor_smp:    "Koordinator Qur’an unit SMP",
  koor_qulssd: "Koordinator QULS SD",
  koor_tpait:  "Koordinator Qur’an unit TPAIT",
  koor_sdjuara:"Koordinator Qur’an unit SD Juara",
  koor_sma:    "Koordinator Qur’an unit SMA",
  koor_ekstra: "Koordinator Ekstra RQ LHI",
  humas:       "Humas RQ LHI",
  div_training:"Divisi Training",
  new_squad:   "New Squad",
  div_quran_bpa: "Divisi Qur’an Boarding Putra",
  div_quran_bpi: "Divisi Qur’an Boarding Putri",
  // Bukan jabatan — tidak ada di JABATAN_ORDER, tidak bisa diduduki guru.
  admin: "Admin Sistem",
}

/**
 * Urutan jabatan di halaman Pengurus — struktural, bukan abjad: pimpinan,
 * lalu divisi penopang, lalu para koordinator lapangan.
 */
export const JABATAN_ORDER: UserRole[] = [
  "kepala_rq", "kumik", "sdm", "bendahara",
  "koor_sd", "koor_smp", "koor_qulssd",
  "koor_tpait", "koor_sdjuara", "koor_sma", "koor_ekstra",
  "div_quran_bpa", "div_quran_bpi",
  "humas", "div_training", "new_squad",
]

/**
 * Boleh menetapkan siapa yang menduduki tiap jabatan pengurus.
 *
 * Admin saja (dulu Kepala RQ, dipindah sejak 0090). Ini wewenang penempatan
 * orang, satu tingkat di atas SDM yang mengurus rekam kepegawaiannya — dan
 * hasilnya menentukan profil siapa yang tampil di akun jabatan tersebut.
 */
export function canManagePengurus(role: UserRole): boolean {
  return role === "admin"
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high:   'High',
  middle: 'Middle',
  low:    'Low',
}

export const TASK_WEIGHT_LABELS: Record<TaskWeight, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
}

export const TASK_PROBLEM_LABELS: Record<TaskProblemType, string> = {
  bottleneck: 'Bottleneck',
  blocked:    'Blocked',
  wip_limit:  'WIP Limit',
  others:     'Lainnya',
}

export const AGENDA_TAG_LABELS: Record<AgendaTag, string> = {
  keputusan:     'Keputusan',
  informasi:     'Informasi',
  perlu_diskusi: 'Perlu Diskusi Lanjut',
  tindak_lanjut: 'Tindak Lanjut',
  approval:      'Approval',
  informasi_bph: 'Informasi BPH',
  bahas_bph:     'Bahas di BPH',
}

/**
 * Kategori notulen khusus BPH (0111). Hanya bermakna di rapat yang membawa
 * urusan ke BPH — Rapat Manajemen dan rapat-rapat Koor; rapat lain tidak
 * menawarkannya.
 */
export const TAG_BPH: AgendaTag[] = ['informasi_bph', 'bahas_bph']
const RAPAT_DENGAN_BPH: MeetingType[] = [
  'manajemen',
  'koor_sd', 'koor_smp', 'koor_tpait', 'koor_sdjuara', 'koor_sma',
  'koor_x_sd', 'koor_x_smp', 'koor_x_boarding',
]

/** Kategori notulen yang boleh dipilih di sebuah jenis rapat, urut seperti AGENDA_TAG_LABELS. */
export function tagNotulenUntuk(type: MeetingType): AgendaTag[] {
  const semua = Object.keys(AGENDA_TAG_LABELS) as AgendaTag[]
  return RAPAT_DENGAN_BPH.includes(type) ? semua : semua.filter(t => !TAG_BPH.includes(t))
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  manajemen: 'Rapat Manajemen',
  kumik: 'Rapat Kumik',
  new_squad: 'Rapat New Squad',
  koor_sd: 'Rapat Koor SD',
  koor_smp: 'Rapat Koor SMP',
  koor_x_sd: 'Rapat Koor x SD',
  koor_x_smp: 'Rapat Koor x SMP',
  koor_x_boarding: 'Rapat Koor x Boarding',
  rq_x_quls: 'Rapat RQ x QULS',
  humas_yayasan: 'Rapat Humas Yayasan',
  tahsin_rekomendasi: 'Rapat Tahsin Rekomendasi',
  quls_sd: 'Rapat QULS SD',
  koor_tpait: 'Rapat Koor TPAIT',
  koor_sdjuara: 'Rapat Koor SD Juara',
  koor_sma: 'Rapat Koor SMA',
}

export const DASHBOARD_LABELS: Record<string, string> = {
  manajemen: 'Manajemen',
  kumik: 'Kumik',
  sdm: 'SDM',
  'koor-sd': 'Koor SD',
  'koor-smp': 'Koor SMP',
  'koor-qulssd': 'Koor QULS SD',
  'koor-tpait': 'Koor TPAIT',
  'koor-sdjuara': 'Koor SD Juara',
  'koor-sma': 'Koor SMA',
  'koor-ekstra': 'Koor Ekstra',
  humas: 'Humas',
  'div-training': 'Div Training',
  pribadi: 'Dashboard Saya',
  admin: 'Admin',
}

export const DEFAULT_DASHBOARD: Record<UserRole, string> = {
  kepala_rq: 'manajemen',
  kumik: 'kumik',
  sdm: 'sdm',
  bendahara: 'pribadi',
  koor_sd: 'koor-sd',
  koor_smp: 'koor-smp',
  koor_qulssd: 'koor-qulssd',
  koor_tpait: 'koor-tpait',
  koor_sdjuara: 'koor-sdjuara',
  koor_sma: 'koor-sma',
  koor_ekstra: 'koor-ekstra',
  humas: 'humas',
  div_training: 'div-training',
  new_squad: 'pribadi',
  // Menumpang dashboard pribadi: tugas mereka cuma profil, ujian, dan rapat,
  // jadi tidak ada papan divisi yang perlu dibuatkan sendiri.
  div_quran_bpa: 'pribadi',
  div_quran_bpi: 'pribadi',
  admin: 'admin',
}

// Pembinaan Guru & Karyawan (Gukar)
//
// Pengisiannya bukan urusan role melainkan penugasan: pengampu mengisi
// kelompoknya sendiri lewat portal /guru, dan itu diperiksa terhadap
// gukar_groups.pengampu_id, bukan lewat fungsi di sini.
/**
 * Boleh membuka rekap & analitik pembinaan seluruh kelompok.
 *
 * SDM sebagai pemilik program, dan Kepala RQ karena laporan bulanan ke BPH
 * memuat pembinaan guru. Pengampu lain cukup melihat kelompoknya sendiri
 * lewat portal guru -- penugasan, bukan role, yang menentukannya di sana.
 */
export function canViewGukarRecap(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq'
}

/** Boleh menata kelompok & peserta pembinaan (bukan sekadar mengisi capaian). */
export function canManageGukar(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq'
}

// Koreksi setoran santri
//
// Guru sengaja TIDAK diberi akses. Ia mencatat, pengurus yang membetulkan —
// begitu keputusannya, supaya riwayat capaian tidak bisa diubah diam-diam
// oleh orang yang nilainya sedang dinilai.
/**
 * Boleh menyunting & menghapus setoran santri.
 *
 * Kepala RQ dan Kumik untuk semua jenjang; koor hanya unitnya sendiri —
 * cakupan yang sama dengan wewenangnya mengelola siswa.
 */
export function canManageSetoran(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  if (role === 'kepala_rq' || role === 'kumik') return true
  return canManageStudents(role, jenjang, program)
}

// Halaqoh asrama (0110)
//
// Div Qur'an BPA (putra) dan BPI (putri) mengelola kelompok asrama: pengampu,
// anggota, dan level anak. Keduanya MELIHAT asrama putra maupun putri — rapat
// Koor x Boarding membahas keduanya — tapi hanya MENGUBAH asramanya sendiri.
/** Boleh membuka halaman asrama (kelompok, level, progres setoran). */
export function canViewAsrama(role: UserRole): boolean {
  return ['kepala_rq', 'kumik', 'koor_smp', 'div_quran_bpa', 'div_quran_bpi'].includes(role)
}

/**
 * Boleh mengubah kelompok asrama ber-gender ini — termasuk mengoreksi
 * setoran anggotanya. Tanpa gender: boleh mengubah setidaknya satu asrama.
 */
export function canManageAsrama(role: UserRole, gender?: 'L' | 'P' | null): boolean {
  if (role === 'kepala_rq' || role === 'kumik') return true
  if (role === 'div_quran_bpa') return !gender || gender === 'L'
  if (role === 'div_quran_bpi') return !gender || gender === 'P'
  return false
}

/**
 * Boleh menyunting & menghapus catatan pembinaan guru/karyawan.
 *
 * Pembinaan gukar programnya SDM, jadi SDM dan Kepala RQ yang membetulkan.
 * Pengampu tetap bisa mengisi kelompoknya sendiri — itu diperiksa terhadap
 * gukar_groups.pengampu_id, bukan lewat fungsi ini.
 */
export function canManageGukarSetoran(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq'
}

// ── KPI bulanan guru Qur'an ────────────────────────────────────────

/**
 * Siapa yang mengisi nilai KPI: SDM.
 *
 * Kepala RQ ikut diberi hak tulis karena ia atasan langsung fungsi SDM dan
 * perlu bisa membetulkan kalau SDM berhalangan — bukan supaya rutin mengisi.
 */
export function canInputKpi(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq'
}

/**
 * Siapa yang boleh melihat hasil KPI.
 *
 * Sengaja lebih sempit daripada papan tugas: ini penilaian perorangan atas
 * kinerja, bukan informasi kerja harian. Koordinator unit ikut dimasukkan
 * karena merekalah yang menjalankan tindak lanjut pada level 1-4.
 */
export function canViewKpi(role: UserRole): boolean {
  // Koordinator ikut bila ia mengesahkan KPI sebuah unit (KOOR_PENGESAH) —
  // satu peta, supaya unit baru tidak perlu ditambahkan di tiga tempat.
  return canInputKpi(role) || role === 'kumik' || unitPengesahan(role).length > 0
}

/**
 * Menyimak & mencatat setoran guru Qur'an (0096): SDM saja. Setoran terakhir
 * bulanan mengisi posisi hafalan di KPI, jadi pencatatnya sama dengan pemilik
 * KPI; yang lain (Kepala RQ, koordinator) cukup melihat.
 */
export function canCatatSetoranGuru(role: UserRole): boolean {
  return role === 'sdm'
}

/**
 * Siapa yang boleh mencetak rapor KPI bulanan seorang guru: SDM saja.
 *
 * Lebih sempit daripada canViewKpi, dan itu disengaja. Halaman KPI adalah
 * pemantauan internal; rapor cetak adalah dokumen yang keluar dari lingkaran
 * pengurus dan diserahkan kepada guru yang bersangkutan, lengkap dengan kolom
 * tanda tangan. Yang menerbitkan dokumen kepegawaian di RQ adalah SDM, jadi
 * satu peran itu pula yang memegang tombolnya — termasuk tidak Kepala RQ,
 * supaya tidak ada dua pihak yang menerbitkan rapor yang sama dengan tanggal
 * terbit berbeda.
 */
export function canPrintKpiRapor(role: UserRole): boolean {
  return role === 'sdm'
}

// ── Pengesahan rapor KPI (0050) ────────────────────────────────────

/**
 * Koordinator yang menaungi tiap unit — penanda tangan rapornya.
 *
 * Guru QULS SD ikut di bawah Koor SD: unitnya memang sd, dan pemisahan
 * pembinaan QULS SD belum sampai ke jalur pengesahan KPI. SD LHI Juara
 * disahkan koordinatornya sendiri sejak unit itu punya koor (0099).
 *
 * Record penuh, bukan Partial: unit baru yang lupa ditambahkan di sini
 * langsung gagal dikompilasi. `null` = sengaja tanpa koor pengesah.
 * Kalau kelak Koor QULS SD yang mengesahkan anak buahnya sendiri, cukup peta ini
 * yang berubah — lib/data/kpi-rapor.ts membacanya lewat koorPengesah(), tidak
 * memelihara petanya sendiri.
 */
const KOOR_PENGESAH: Record<Jenjang, UserRole | null> = {
  // TPAIT, SD Juara & SMA sengaja tanpa KPI: gurunya dinilai langsung oleh
  // kepala unitnya, di luar sistem ini (SD Juara sejak 2026-10-01).
  paud: null,
  sd: 'koor_sd',
  sd_juara: null,
  smp: 'koor_smp',
  sma: null,
}

/** Unit yang rapor KPI gurunya disahkan `role` — untuk lencana antrean pengesahan. */
export function unitPengesahan(role: UserRole): Jenjang[] {
  return (Object.keys(KOOR_PENGESAH) as Jenjang[]).filter(u => KOOR_PENGESAH[u] === role)
}

/**
 * Guru berlingkup yayasan disahkan Kepala RQ, bukan koordinator unit mana pun.
 *
 * Ini pengecualian yang sengaja dibuat, dan alasannya sama dengan alasan
 * Kepala RQ dikecualikan di tempat lain — hanya diterapkan terbalik. Tanda
 * tangan pada rapor menyatakan "saya menyaksikan kinerja ini". Koor SD tidak
 * menyaksikan kinerja seorang guru yang tugasnya melintasi seluruh yayasan,
 * jadi tanda tangannya di sana adalah kesaksian yang tidak pernah terjadi.
 *
 * `lingkup` menang atas `unit`. Guru lintas yayasan boleh tetap punya unit —
 * unit itulah yang menentukan rubrik KPI mana yang dipakai (lihat paramFor) —
 * tapi unit tidak lagi menentukan siapa yang menandatangani.
 */
export function koorPengesah(
  unit: Jenjang | null,
  lingkup: LingkupPenugasan = 'unit',
): UserRole | null {
  if (lingkup === 'yayasan') return 'kepala_rq'
  return (unit && KOOR_PENGESAH[unit]) ?? null
}

/**
 * Siapa yang menandatangani & memublikasikan rapor kepada guru.
 *
 * Terikat unit: Koor SMP tidak bisa menerbitkan rapor guru SD, meski
 * jabatannya setara. Yang disahkan adalah penilaian atas orang yang ia pimpin
 * langsung — di luar itu ia menandatangani sesuatu yang tidak ia saksikan.
 *
 * Kepala RQ TIDAK ikut atas rapor guru unit. Bukan karena wewenangnya kurang,
 * melainkan karena tanda tangan pada rapor menyatakan "saya koordinator yang
 * menyaksikan kinerja ini". Kalau Kepala RQ perlu turun tangan atas rapor guru
 * unit, jalurnya reset — yang meninggalkan jejak — bukan menandatangani atas
 * nama koordinator.
 *
 * Yang berlingkup yayasan justru sebaliknya (0052): di sana Kepala RQ-lah
 * atasan langsungnya, dan koor unit yang bukan. Alasannya satu dan sama —
 * yang menandatangani adalah yang menyaksikan.
 */
export function canPublishKpiRapor(
  role: UserRole,
  unit: Jenjang | null,
  lingkup: LingkupPenugasan = 'unit',
): boolean {
  const koor = koorPengesah(unit, lingkup)
  return koor !== null && role === koor
}

/**
 * Punya halaman publikasi sama sekali? Dipakai untuk menampilkan menunya.
 *
 * Kepala RQ ikut sejak 0052 — bukan untuk menandatangani rapor guru unit
 * (canPublishKpiRapor tetap menolaknya per baris), melainkan karena rapor guru
 * berlingkup yayasan tidak punya meja lain untuk ditandatangani. Pemisahan
 * wewenangnya tetap utuh: yang menentukan bukan siapa yang boleh membuka
 * halamannya, melainkan baris mana yang bisa ia terbitkan di dalamnya.
 */
export function canAccessKpiPublikasi(role: UserRole): boolean {
  return role === 'kepala_rq' || unitPengesahan(role).length > 0
}

/**
 * Siapa yang memutus banding, per tingkat.
 *
 * Tingkat 1 sengketa FAKTA — SDM, sebab dialah pemegang data sumbernya.
 * Tingkat 2 sengketa PENILAIAN — Kepala RQ, dan putusannya final.
 *
 * Koordinator tidak memutus di tingkat mana pun: dialah yang menandatangani
 * rapor yang disanggah, jadi menjadikannya hakim atas sanggahan terhadap tanda
 * tangannya sendiri tidak adil bagi kedua belah pihak.
 */
export function canDecideKpiBanding(role: UserRole, tingkat: number): boolean {
  if (tingkat === 1) return role === 'sdm'
  if (tingkat === 2) return role === 'kepala_rq'
  return false
}

/** Boleh membuka daftar banding — pemutus kedua tingkat, plus koordinator. */
export function canViewKpiBanding(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq' || canAccessKpiPublikasi(role)
}

/**
 * Siapa yang boleh membuka kunci rapor yang sudah terbit: Kepala RQ saja.
 *
 * SDM sengaja tidak, meski dialah yang mengisi nilainya. Rapor terbit adalah
 * dokumen yang sudah diserahkan dan mungkin sudah ditandatangani guru;
 * memberi hak mengubahnya kepada pihak yang sama yang menyusunnya membuat
 * tanda tangan guru tidak menjamin apa pun. Reset oleh Kepala RQ mengosongkan
 * nilainya, membatalkan kedua tanda tangan, dan menaikkan nomor versi —
 * sehingga perubahan atas rapor terbit selalu kasat mata.
 */
export function canResetKpiRapor(role: UserRole): boolean {
  return role === 'kepala_rq'
}

/**
 * Siapa yang boleh melihat LEMBAR rapor seorang guru.
 *
 * Lebih luas daripada canPrintKpiRapor: koordinator harus bisa membaca lembar
 * yang akan ia tandatangani, dan Kepala RQ harus bisa memeriksanya saat
 * memutus banding tingkat akhir. Yang tetap milik SDM sendiri adalah
 * menerbitkan dokumennya.
 */
export function canViewKpiRaporSheet(role: UserRole): boolean {
  return role === 'sdm' || role === 'kepala_rq' || canAccessKpiPublikasi(role)
}

/**
 * Kelola akun & password seluruh pengguna — khusus admin.
 *
 * Tidak diberikan ke SDM meski SDM mengelola kepegawaian: hak ini mencakup
 * mengganti password akun mana pun, jadi memberikannya ke peran lain
 * membuat siapa pun pemegangnya bisa mengambil alih akun tertinggi.
 */
export function canManageAllAccounts(role: UserRole): boolean {
  return role === 'admin'
}

/**
 * Akun admin sistem — bukan jabatan pengurus. Tidak punya dashboard, tugas,
 * rapat, maupun analitik; menunya hanya Pengurus, Akun & Password, Karyawan.
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin'
}

// ── Pembinaan Gukar ────────────────────────────────────────────────

/** Data guru yang menentukan hak mengampu pembinaan gukar. */
export interface GuruPembinaGukar {
  employment_type: TeacherEmployment | null
  kategori_guru: KategoriGuru | null
  unit: Jenjang | null
  /** Ditunjuk koordinator unitnya (0106) — hanya berlaku di TPAIT & SMA. */
  pembina_gukar: boolean | null
}

/**
 * Unit yang pembina gukarnya DITUNJUK koordinator, beserta koordinatornya.
 * Di TPAIT dan SMA hanya guru tertentu yang mengampu; aturan status + Guru RQ
 * tidak berlaku di sana (keputusan 2026-09-29).
 */
const KOOR_PENUNJUK_PEMBINA: Partial<Record<UserRole, Jenjang>> = {
  koor_tpait: 'paud',
  koor_sma: 'sma',
}

/**
 * Unit penunjukan seorang guru — 'paud'/'sma' bila unit atau kategorinya di
 * sana, null bila ia mengikuti aturan umum. Kategori ikut dibaca karena unit
 * guru lama sering masih kosong walau kategorinya sudah Guru TPAIT/SMA.
 */
export function unitPenunjukanGukar(guru: Pick<GuruPembinaGukar, 'unit' | 'kategori_guru'>): Jenjang | null {
  const unit = guru.unit ?? (guru.kategori_guru ? KATEGORI_GURU_UNIT[guru.kategori_guru] ?? null : null)
  return unit && Object.values(KOOR_PENUNJUK_PEMBINA).includes(unit) ? unit : null
}

/**
 * Boleh mengampu pembinaan Guru & Karyawan?
 *
 * Dua aturan, menurut unit gurunya:
 *
 * - SD, SD Juara, SMP (dan guru tanpa unit): hanya GURU RQ berstatus Tetap
 *   Yayasan atau Kontrak Yayasan. Guru Kontrak RQ (OS) tidak — ikatannya
 *   lewat pihak ketiga; Guru QULS SD, Guru SD Juara, dan Musyrif/ah juga tidak,
 *   walau berstatus yayasan.
 * - TPAIT & SMA: hanya guru yang ditunjuk koordinatornya (pembina_gukar),
 *   apa pun status dan kategorinya.
 *
 * Yang disaring PENGAMPU-nya, bukan peserta. Peserta gukar datang dari seluruh
 * yayasan, dan status mereka tidak menentukan apa pun di sini.
 *
 * Data yang kosong diperlakukan sebagai TIDAK boleh: lebih baik pengampu yang
 * datanya belum lengkap kehilangan akses dan melapor, daripada hak ini
 * diberikan diam-diam karena datanya kebetulan kosong.
 */
export function canDoGukarPembinaan(guru: GuruPembinaGukar): boolean {
  if (unitPenunjukanGukar(guru)) return guru.pembina_gukar === true
  const yayasan = guru.employment_type === 'tetap_yayasan' || guru.employment_type === 'kontrak_yayasan'
  return yayasan && guru.kategori_guru === 'guru_rq'
}

/** Unit yang pembina gukarnya boleh ditunjuk peran ini; null = tidak boleh menunjuk. */
export function getUnitPenunjukPembinaGukar(role: UserRole): Jenjang | null {
  return KOOR_PENUNJUK_PEMBINA[role] ?? null
}

// ── Pengajuan ujian tahsin & tahfidz ───────────────────────────────

/**
 * Unit mana yang ujiannya boleh dikelola seorang pengurus.
 *
 * Kepala RQ dan Kumik memegang keduanya karena merekalah yang memantau
 * capaian lintas unit; koordinator hanya unitnya sendiri, sama persis dengan
 * cakupannya di getManageableJenjang(). Daftar kosong berarti menu ujian
 * tidak muncul sama sekali untuk role itu.
 */
const SEMUA_UNIT_UJIAN: UjianUnit[] = ['TPAIT', 'SD', 'SD Juara', 'SMP', 'SMA']

/** Antrean ujian milik tiap koordinator unit — satu lawan satu (0100). */
const KOOR_UNIT_UJIAN: Partial<Record<UserRole, UjianUnit>> = {
  koor_tpait: 'TPAIT',
  koor_sd: 'SD',
  // Berbagi antrean SD dengan koor SD (keputusan 2026-09-29), tapi hanya
  // baris anak QULS — lihat ujianHanyaQuls().
  koor_qulssd: 'SD',
  koor_sdjuara: 'SD Juara',
  koor_smp: 'SMP',
  koor_sma: 'SMA',
  // BPA & BPI membina santri asrama SMPIT LHI, jadi cakupan ujiannya sama
  // persis dengan koor SMP.
  div_quran_bpa: 'SMP',
  div_quran_bpi: 'SMP',
}

export function getUjianUnits(role: UserRole): UjianUnit[] {
  if (role === 'kepala_rq' || role === 'kumik') return SEMUA_UNIT_UJIAN
  const unit = KOOR_UNIT_UJIAN[role]
  return unit ? [unit] : []
}

/** Koordinator yang menerima kabar pengajuan baru di satu antrean. */
export function getKoorUnitUjian(role: UserRole): UjianUnit | null {
  return isKoorUjian(role) ? KOOR_UNIT_UJIAN[role] ?? null : null
}

/** Koor unit + koor QULS SD — pemegang (sebagian) satu antrean ujian. */
function isKoorUjian(role: UserRole): boolean {
  return isKoorUnit(role) || role === 'koor_qulssd'
}

/**
 * Pengurus ini hanya menyentuh ujian anak QULS di antreannya?
 *
 * Koor QULS SD tidak punya antrean sendiri: ia memakai antrean SD bersama
 * koor SD, dan bagiannya dibedakan oleh tanda is_quls pada tiap baris ujian
 * (tahsin sejak 0105). Koor SD tetap memegang seluruh antrean SD.
 */
export function ujianHanyaQuls(role: UserRole): boolean {
  return role === 'koor_qulssd'
}

/**
 * Program siswa yang boleh diajukan/dicatat ujiannya oleh pengurus ini —
 * null berarti seluruh siswa unitnya. Padanan ujianHanyaQuls untuk kueri
 * yang membaca tabel students, bukan tabel ujian.
 */
export function getUjianProgramScope(role: UserRole): readonly string[] | null {
  return ujianHanyaQuls(role) ? QULS_SD_PROGRAMS : null
}

/**
 * Boleh menjadwalkan, menilai, dan menghapus SATU baris ujian — unitnya dan,
 * bagi koor QULS SD, tanda QULS-nya. Keduanya dibaca dari baris di database,
 * bukan dari kiriman form.
 */
export function canManageUjianBaris(
  role: UserRole,
  baris: { unit: UjianUnit; is_quls?: boolean | null },
): boolean {
  if (!canManageUjian(role, baris.unit)) return false
  return !ujianHanyaQuls(role) || baris.is_quls === true
}

/**
 * Unit yang ujiannya dihitung dalam panel "Beban penguji".
 *
 * Daftar penguji satu untuk seluruh unit dan mereka saling menguji lintas
 * unit, jadi tiap koor unit perlu melihat beban dari semua antrean — tanpa
 * itu penguji yang sudah penuh di unit sebelah tampak longgar. Ini hanya
 * penglihatan: mengelola pengajuan tetap dibatasi getUjianUnits/canManageUjian.
 * Peran lain (BPA/BPI) tidak menguji lintas unit, jadi cakupannya tetap
 * unitnya sendiri.
 */
export function getUnitBebanPenguji(role: UserRole): UjianUnit[] {
  if (isKoorUjian(role)) return SEMUA_UNIT_UJIAN
  return getUjianUnits(role)
}

/** Boleh membuka modul ujian (kelola, riwayat, daftar penguji). */
export function canViewUjian(role: UserRole): boolean {
  return getUjianUnits(role).length > 0
}

/**
 * Boleh menjadwalkan, menilai, dan menghapus pengajuan di unit tertentu.
 *
 * Dipisah dari canViewUjian supaya pemeriksaannya selalu menyertakan unit —
 * koor SD tidak boleh menyentuh antrian SMP walau kedua daftar itu tampil di
 * halaman yang sama. Unit datang dari baris di database, bukan dari form.
 */
export function canManageUjian(role: UserRole, unit: UjianUnit): boolean {
  return getUjianUnits(role).includes(unit)
}

/**
 * Div Qur'an BPA/BPI hanya MENGAJUKAN ujian anak boarding segendernya
 * (keputusan RQ 2026-10-01): BPA anak boarding putra, BPI putri. Antrean SMP
 * tetap dikelola bersama Koor SMP; yang dipersempit hanya siapa yang boleh
 * mereka ajukan, dan lonceng pengajuan baru hanya untuk anak boarding itu.
 * null = tidak dibatasi gender boarding.
 */
export function getUjianBoardingScope(role: UserRole): 'L' | 'P' | null {
  if (role === 'div_quran_bpa') return 'L'
  if (role === 'div_quran_bpi') return 'P'
  return null
}

/** Program SMP yang tinggal di asrama — dasar getUjianBoardingScope. */
export const PROGRAM_SMP_BOARDING = ['reguler_bd', 'boarding_quls'] as const

/**
 * Boleh mengajukan ujian lewat dashboard pengurus.
 *
 * Pengaju utamanya guru lewat portal /guru; koordinator diberi hak yang sama
 * karena ia kerap mengajukan untuk anak yang gurunya berhalangan.
 */
export function canSubmitUjian(role: UserRole): boolean {
  return canViewUjian(role)
}

/**
 * Template rapor Qur'an (0082) — diunggah & dipetakan koordinator unit.
 *
 * Cakupannya sama dengan wewenang mengelola siswa: koor SD mengurus format
 * SD, koor SMP format SMP. Formatnya milik unit, bukan milik seorang guru —
 * guru memakainya, tapi tidak boleh mengubah bentuk rapor seluruh angkatan.
 */
export function canManageRaporTemplate(role: UserRole, jenjang?: Jenjang | null): boolean {
  // Template rapor SD Juara diurus Kepala RQ & Kumik, bukan Koor SD Juara
  // (keputusan RQ 2026-10-01).
  if (role === 'koor_sdjuara') return false
  return canManageStudents(role, jenjang)
}

/**
 * Kalender Qur'an (hari aktif & jumlah TM per program). Dulu menumpang izin
 * template rapor; dipisah sejak Koor SD Juara tidak lagi memegang template
 * tapi tetap memegang kalender unitnya.
 */
export function canManageKalenderQuran(role: UserRole, jenjang?: Jenjang | null): boolean {
  return canManageStudents(role, jenjang)
}

/**
 * Kalender Qur'an SD dipegang dua koordinator yang wewenangnya dipotong per
 * program (koor SD: non-QULS, koor QULS SD: QULS). Bagi keduanya, hari aktif
 * hanya untuk programnya sendiri, dan hari kosong hanya untuk rombel yang
 * seluruh anaknya ia kelola — tidak "seluruh angkatan", sebab satu angkatan
 * SD berisi rombel milik keduanya (mis. 1A reguler, 1D QULS).
 */
export function kalenderPerProgram(role: UserRole, jenjang: Jenjang): boolean {
  return jenjang === 'sd' && (role === 'koor_sd' || role === 'koor_qulssd')
}

/**
 * Riyadhoh Qur'an SMP (0087) — jadwal Sabtu putra/putri, pengampu, dan
 * peserta. Fitur Koordinator SMP saja: menu, halaman kelola, dan aksinya.
 * Pengampu tetap menjalankannya dari portal guru (/guru/riyadhoh), yang
 * aksesnya ditentukan penugasan, bukan peran ini.
 */
export function canManageRiyadhoh(role: UserRole): boolean {
  return role === 'koor_smp'
}

/** Analitik Riyadhoh Sabtu — dibaca Kurikulum, Koordinator SMP, dan Kepala RQ. */
export function canViewRiyadhohAnalitik(role: UserRole): boolean {
  return role === 'kumik' || role === 'koor_smp' || role === 'kepala_rq'
}

/**
 * Kalender pendidikan (kaldik, 0085) — agenda sekolah yang tampil di beranda
 * dan menjadi usulan hari kosong di Kalender Qur'an.
 *
 * Dipegang koordinator unit: merekalah yang paling awal tahu ada class
 * meeting atau outing, dan mereka pula yang memakai kalender itu untuk
 * menandai sesi Qur'an yang ditiadakan.
 *
 * Agenda ber-unit NASIONAL dan RQ tidak dimiliki unit mana pun — libur
 * nasional dan agenda lembaga mengenai semua. Keduanya boleh disunting
 * koordinator unit mana saja; kalau tidak, 57 agenda lintas unit tidak akan
 * punya siapa pun yang boleh membetulkannya.
 */
export function canManageKaldik(role: UserRole, unit?: string | null): boolean {
  const u = (unit ?? '').toUpperCase()
  if (!u || u === 'NASIONAL' || u === 'RQ') return isKoorUnit(role) || role === 'koor_qulssd'
  // SD Juara mengikuti agenda SD (lihat UNIT_KALDIK di /kalender-quran).
  if (u === 'SD') return role === 'koor_sd' || role === 'koor_qulssd' || role === 'koor_sdjuara'
  if (u === 'SMP') return role === 'koor_smp'
  if (u === 'TPAIT') return role === 'koor_tpait'
  if (u === 'SMA') return role === 'koor_sma'
  return false
}


/**
 * Ekstra tahsin & tahfidz (0091): membuat jenis ekstra, membuka slot guru,
 * dan menangani booking orang tua.
 */
export function canManageEkstra(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'koor_ekstra'
}

// ── Laporan bulanan Kurikulum (Bab 02 BPH, 0092) ─────────────────────

/** Membuka laporan bulanan kurikulum: Kumik yang menyusun, Kepala RQ yang menyetujui. */
export function canViewLaporanKurikulum(role: UserRole): boolean {
  return role === 'kumik' || role === 'kepala_rq'
}

/**
 * Membuat edisi, menghitung ulang angka, dan menulis narasi. Kumik
 * pemiliknya; Kepala RQ ikut boleh supaya laporan tidak tertahan bila
 * Kumik berhalangan.
 */
export function canSusunLaporanKurikulum(role: UserRole): boolean {
  return role === 'kumik' || role === 'kepala_rq'
}

// ── Panduan Guru (0104) ──────────────────────────────────────────────────

/** Sasaran pembaca dokumen panduan: seluruh guru, satu unit, atau guru QULS SD. */
export type SasaranPanduan = 'semua' | Jenjang | 'quls_sd'

/**
 * Sasaran dokumen yang boleh diunggah & dikelola peran ini — null berarti
 * tidak boleh. Lingkup global untuk pimpinan & divisi penopang; lokal untuk
 * koordinator unit (hanya guru unitnya yang membaca).
 */
export function sasaranUnggahPanduan(role: UserRole): SasaranPanduan | null {
  if (['kepala_rq', 'bendahara', 'sdm', 'kumik', 'koor_ekstra'].includes(role)) return 'semua'
  if (role === 'koor_qulssd') return 'quls_sd'
  return KOOR_UNIT[role] ?? null
}

export function canKelolaPanduanGuru(role: UserRole): boolean {
  return sasaranUnggahPanduan(role) !== null
}

// ── Target bulanan tahsin & tahfidz (0103) ───────────────────────────────

/**
 * Menetapkan rentang target bulanan & ambang kategorinya: Kumik pemiliknya;
 * Kepala RQ ikut supaya target tidak tertahan bila Kumik berhalangan.
 */
export function canKelolaTargetBulanan(role: UserRole): boolean {
  return role === 'kumik' || role === 'kepala_rq'
}

/** Membaca target bulanan: pengelolanya, plus para koordinator unit (baca saja). */
export function canViewTargetBulanan(role: UserRole): boolean {
  return canKelolaTargetBulanan(role) || isKoorUnit(role) || role === 'koor_qulssd'
}

/** Menyetujui atau mengembalikan edisi yang diajukan — Kepala RQ saja. */
export function canSetujuiLaporanKurikulum(role: UserRole): boolean {
  return role === 'kepala_rq'
}

// ── Keterangan publik guru (kartu /profil-guru & beranda) ─────────────

/**
 * Keterangan jabatan pengurus di kartu guru publik. Lebih ringkas dari
 * AMANAH_LABELS (yang dipakai dokumen resmi), dan mengikuti kursi di menu
 * Pengurus — begitu kursi berpindah orang, keterangannya ikut berpindah.
 */
export const KETERANGAN_PUBLIK_JABATAN: Record<UserRole, string> = {
  kepala_rq: "Kepala Rumah Qur'an LHI",
  kumik: 'Kumik RQ',
  sdm: 'SDM RQ',
  bendahara: 'Bendahara RQ',
  koor_sd: 'Koordinator SD',
  koor_smp: 'Koordinator SMP',
  koor_qulssd: 'Koordinator QULS',
  koor_tpait: 'Koordinator TPAIT',
  koor_sdjuara: 'Koordinator SD Juara',
  koor_sma: 'Koordinator SMA',
  koor_ekstra: 'Koordinator Ekstra',
  humas: 'Humas RQ',
  div_training: 'Divisi Training RQ',
  new_squad: 'New Squad RQ',
  div_quran_bpa: "Divisi Qur'an Boarding Putra",
  div_quran_bpi: "Divisi Qur'an Boarding Putri",
  // Akun sistem, bukan jabatan — tidak pernah diduduki guru.
  admin: '',
}

/** Keterangan guru yang bukan pengurus, menurut unit tempatnya mengajar. */
export const KETERANGAN_PUBLIK_UNIT: Record<Jenjang, string> = {
  paud: "Guru Qur'an TPAIT LHI",
  sd: "Guru Qur'an SDIT LHI",
  sd_juara: "Guru Qur'an SD LHI Juara",
  smp: "Guru Qur'an SMPIT LHI",
  sma: "Guru Qur'an SMA LHI",
}
