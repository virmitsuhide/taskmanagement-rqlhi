import { getProgramsForJenjang, isQulsSdProgram, QULS_SD_PROGRAMS } from '@/lib/rq/programs'
import type {
  UserRole, MeetingType, AgendaTag, TaskStatus, TaskPriority, TaskWeight,
  TaskProblemType, PublicTarget, Jenjang, TeacherEmployment, UjianUnit,
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
  'koor-ekstra': ['koor_ekstra'],
  humas: ['humas'],
  'div-training': ['div_training'],
  pribadi: ['bendahara', 'new_squad'],
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
  koor_x_boarding: ['koor_smp'],
  rq_x_quls: ['kumik'],
  humas_yayasan: ['humas'],
  tahsin_rekomendasi: ['koor_sd'],
  quls_sd: ['koor_qulssd'],
}

const MEETING_EDIT: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kumik', 'koor_sd', 'koor_smp', 'koor_ekstra'],
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
}

const MEETING_VIEW: Record<MeetingType, UserRole[]> = {
  manajemen: ['kepala_rq', 'kumik', 'sdm', 'bendahara'],
  kumik: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra', 'koor_qulssd'],
  // Para koor & Humas ikut memantau notulen New Squad.
  new_squad: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'div_training', 'new_squad', 'koor_sd', 'koor_smp', 'koor_ekstra', 'koor_qulssd', 'humas'],
  // Koor QULS SD ikut membaca: kelompoknya duduk di sesi & unit yang sama,
  // jadi keputusan rapat koor SD kerap menyangkut anak-anaknya juga.
  koor_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_qulssd'],
  koor_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_sd: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd'],
  koor_x_smp: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
  koor_x_boarding: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_smp'],
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

export function canViewMeeting(role: UserRole, type: MeetingType): boolean {
  return MEETING_VIEW[type]?.includes(role) ?? false
}

export function getViewableMeetingTypes(role: UserRole): MeetingType[] {
  return (Object.entries(MEETING_VIEW) as [MeetingType, UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([type]) => type)
}

// Task assignment — who can assign to whom
const TASK_ASSIGN_TO: Record<UserRole, UserRole[]> = {
  kepala_rq: ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'koor_qulssd', 'humas', 'div_training', 'new_squad'],
  kumik: ['koor_sd', 'koor_smp', 'koor_qulssd', 'koor_ekstra', 'humas', 'bendahara'],
  sdm: ['new_squad', 'div_training', 'humas', 'bendahara'],
  koor_sd: ['koor_sd'],
  koor_smp: ['koor_smp'],
  koor_qulssd: ['koor_qulssd'],
  koor_ekstra: ['humas'],
  bendahara: [],
  humas: [],
  div_training: [],
  new_squad: [],
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

export function getBoardDivisions(role: UserRole): UserRole[] {
  if (role === 'kepala_rq' || role === 'kumik' || role === 'sdm') return ALL_ROLES
  // Para koor memantau divisinya sendiri plus New Squad & Humas.
  if (role === 'koor_sd') return ['koor_sd', 'new_squad', 'humas']
  if (role === 'koor_smp') return ['koor_smp', 'new_squad', 'humas']
  if (role === 'koor_qulssd') return ['koor_qulssd', 'new_squad', 'humas']
  if (role === 'koor_ekstra') return ['koor_ekstra', 'new_squad', 'humas']
  // Humas memantau papannya sendiri plus New Squad.
  if (role === 'humas') return ['humas', 'new_squad']
  return []
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
  return canViewAnalytics(role) || role === 'koor_sd' || role === 'koor_smp'
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
const HOME_POST_ROLES: Record<string, UserRole[]> = {
  pengumuman: ['kepala_rq', 'sdm', 'bendahara'],
  tugas_guru_sd: ['koor_sd'],
  tugas_guru_smp: ['koor_smp'],
}

export function canPostToHome(role: UserRole): boolean {
  return Object.values(HOME_POST_ROLES).some(roles => roles.includes(role))
}

export function canPostPengumuman(role: UserRole): boolean {
  return HOME_POST_ROLES.pengumuman.includes(role)
}

export function canPostTugasGuru(role: UserRole): PublicTarget | null {
  if (role === 'kepala_rq') return 'all'
  if (HOME_POST_ROLES.tugas_guru_sd.includes(role)) return 'sd'
  if (HOME_POST_ROLES.tugas_guru_smp.includes(role)) return 'smp'
  return null
}

// Humas request
//
// Humas adalah penerima request, bukan pemohon — dia tidak request ke dirinya
// sendiri. Jadi humas tidak boleh membuat request, tapi tetap harus bisa
// membuka daftarnya untuk memproses request yang masuk.
export function canRequestToHumas(role: UserRole): boolean {
  return role !== 'new_squad' && role !== 'humas'
}

/** Siapa yang boleh membuka halaman daftar request: pemohon + humas & kepala RQ. */
export function canViewHumasRequests(role: UserRole): boolean {
  return canRequestToHumas(role) || role === 'humas' || role === 'kepala_rq'
}

// Catatan Keuangan Bendahara
//
// Buku catatan ini milik fungsi keuangan, bukan catatan pribadi per-user:
// bendahara yang menulis, kepala RQ boleh ikut membacanya (read-only).
/** Boleh menulis/mengubah/menghapus catatan keuangan. */
export function canManageFinanceNotes(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Boleh membuka & membaca catatan keuangan. */
export function canViewFinanceNotes(role: UserRole): boolean {
  return canManageFinanceNotes(role) || role === 'kepala_rq'
}

// Modul Keuangan (pencatatan → rekap → laporan BPH)
//
// Aturan aksesnya sama dengan catatan keuangan: bendahara yang mencatat,
// kepala RQ ikut membaca karena dialah yang menyampaikan laporannya ke BPH.
// Dipisah jadi fungsi sendiri supaya kelak bisa berbeda — misal saat BPH
// diberi akses baca laporan tanpa melihat transaksi satu per satu.
/** Boleh mencatat transaksi, anggaran, dana titipan, dan narasi laporan. */
export function canManageFinance(role: UserRole): boolean {
  return role === 'bendahara'
}

/** Boleh membuka modul keuangan & laporannya. */
export function canViewFinance(role: UserRole): boolean {
  return canManageFinance(role) || role === 'kepala_rq'
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

export function canEditProgram(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
}

/**
 * Menu "Program RQ" di sidebar/mobile nav — hanya pengelola program.
 * Halaman /program sendiri tetap publik (dilink dari header beranda).
 */
export function canAccessProgramMenu(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
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
 * beserta urutannya, dan kurasi Profil Guru.
 */
export function canManageHomepage(role: UserRole): boolean {
  return role === 'kepala_rq' || role === 'humas'
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
 * - koor_sd:     jenjang 'sd', kecuali siswa berprogram QULS
 * - koor_qulssd: jenjang 'sd', hanya siswa berprogram QULS
 * - koor_smp:    hanya jenjang 'smp'
 */
export function canManageStudents(role: UserRole, jenjang?: Jenjang | null, program?: ProgramArg): boolean {
  if (role === 'kepala_rq') return true
  if (role === 'koor_smp') return !jenjang || jenjang === 'smp'
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
  return canManageTerms(role) || role === 'koor_sd' || role === 'koor_smp' || role === 'koor_qulssd' || role === 'sdm'
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
export function canManageTeacherProfiles(role: UserRole): boolean {
  return role === 'sdm'
}

/**
 * View list guru (read-only). Lebih luas: kumik & koor juga butuh lihat
 * untuk assign ke halaqoh.
 */
export function canViewTeachers(role: UserRole): boolean {
  return ['kepala_rq', 'sdm', 'kumik', 'koor_sd', 'koor_smp', 'koor_qulssd'].includes(role)
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
  if (role === 'koor_sd')   return ['sd']
  // Koor QULS SD berbagi unit dengan koor SD; yang memisahkan keduanya adalah
  // program, disaring lewat canManageStudents / getViewableProgramScope.
  if (role === 'koor_qulssd') return ['sd']
  if (role === 'koor_smp')  return ['smp']
  return []
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
 * Punya profil pengurus lengkap (data diri, pendidikan, kompetensi, riwayat).
 * New Squad dikecualikan — mereka hanya punya pengaturan akun dasar.
 */
export function canHavePengurusProfile(role: UserRole): boolean {
  return role !== 'new_squad'
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
  humas: 'Humas',
  div_training: 'Div Training',
  new_squad: 'New Squad',
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
}

export const DASHBOARD_LABELS: Record<string, string> = {
  manajemen: 'Manajemen',
  kumik: 'Kumik',
  sdm: 'SDM',
  'koor-sd': 'Koor SD',
  'koor-smp': 'Koor SMP',
  'koor-qulssd': 'Koor QULS SD',
  'koor-ekstra': 'Koor Ekstra',
  humas: 'Humas',
  'div-training': 'Div Training',
  pribadi: 'Dashboard Saya',
}

export const DEFAULT_DASHBOARD: Record<UserRole, string> = {
  kepala_rq: 'manajemen',
  kumik: 'kumik',
  sdm: 'sdm',
  bendahara: 'pribadi',
  koor_sd: 'koor-sd',
  koor_smp: 'koor-smp',
  koor_qulssd: 'koor-qulssd',
  koor_ekstra: 'koor-ekstra',
  humas: 'humas',
  div_training: 'div-training',
  new_squad: 'pribadi',
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
 * karena merekalah yang menjalankan tindak lanjut pada level 1-3.
 */
export function canViewKpi(role: UserRole): boolean {
  return canInputKpi(role) || role === 'kumik' || role === 'koor_sd' || role === 'koor_smp'
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

/**
 * Kelola akun & password seluruh pengguna — khusus Kepala RQ.
 *
 * Tidak diberikan ke SDM meski SDM mengelola kepegawaian: hak ini mencakup
 * mengganti password Kepala RQ sendiri, jadi memberikannya ke peran lain
 * membuat siapa pun pemegangnya bisa mengambil alih akun tertinggi.
 */
export function canManageAllAccounts(role: UserRole): boolean {
  return role === 'kepala_rq'
}

// ── Pembinaan Gukar ────────────────────────────────────────────────

/**
 * Boleh mengampu pembinaan Guru & Karyawan?
 *
 * Pembinaan gukar adalah amanah yayasan, jadi hanya guru yang terikat langsung
 * dengan yayasan yang mengampunya — Tetap Yayasan dan Kontrak Yayasan. Guru
 * Kontrak RQ (OS) tidak, sebab ikatannya lewat pihak ketiga.
 *
 * Yang disaring PENGAMPU-nya, bukan peserta. Ke-161 peserta gukar adalah objek
 * pembinaan yang datang dari seluruh yayasan — PAUD, BPH, musyrif — dan status
 * kepegawaian mereka tidak menentukan apa pun di sini.
 *
 * employment_type null diperlakukan sebagai TIDAK boleh: lebih baik seorang
 * pengampu yang datanya belum lengkap kehilangan akses dan melapor, daripada
 * hak ini diberikan diam-diam karena datanya kebetulan kosong.
 */
export function canDoGukarPembinaan(employment: TeacherEmployment | null | undefined): boolean {
  return employment === 'tetap_yayasan' || employment === 'kontrak_yayasan'
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
export function getUjianUnits(role: UserRole): UjianUnit[] {
  if (role === 'kepala_rq' || role === 'kumik') return ['SD', 'SMP']
  if (role === 'koor_sd') return ['SD']
  if (role === 'koor_smp') return ['SMP']
  return []
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
 * Boleh mengajukan ujian lewat dashboard pengurus.
 *
 * Pengaju utamanya guru lewat portal /guru; koordinator diberi hak yang sama
 * karena ia kerap mengajukan untuk anak yang gurunya berhalangan.
 */
export function canSubmitUjian(role: UserRole): boolean {
  return canViewUjian(role)
}
