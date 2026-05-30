/**
 * Seed data DEMO konten manajemen (lanjutan seed-demo.ts).
 * Idempotent — cek title/subject; skip kalau sudah ada.
 *
 * Jalankan: npm run seed:demo:content
 *
 * Mengisi:
 *  - 6 news articles (berita & artikel di berbagai kategori)
 *  - 3 public posts (pengumuman + tugas guru SD + tugas guru SMP)
 *  - 1 rapat manajemen + 2 agenda + 2 follow-up tasks (source_type='rapat')
 *  - ~12 tugas tambahan untuk berbagai role (pribadi pendek/panjang + delegasi)
 *  - 3 content requests (humas)
 *  - 1 private note (bendahara)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function daysAhead(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d }
function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d }

async function existingTitles(table: string, column = 'title'): Promise<Set<string>> {
  const { data } = await supabase.from(table).select(column)
  return new Set(((data ?? []) as unknown as Record<string, string>[]).map(r => r[column]))
}

async function main() {
  console.log('🌱 Seed konten demo dimulai...\n')

  // ── Ambil user pengurus ─────────────────────────────────────
  const { data: usersData } = await supabase
    .from('users').select('id, username, role, display_name')
    .in('username', ['kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_sd', 'koor_smp', 'koor_ekstra', 'humas'])
  const u = new Map((usersData ?? []).map(r => [r.username, r]))
  function uid(username: string) { return u.get(username)?.id }

  const kepala = uid('kepala_rq')
  const kumik = uid('kumik')
  const sdm = uid('sdm')
  const bendahara = uid('bendahara')
  const koorSd = uid('koor_sd')
  const koorSmp = uid('koor_smp')
  const koorEkstra = uid('koor_ekstra')
  const humas = uid('humas')

  if (!kepala || !kumik || !sdm || !koorSd || !koorSmp || !humas) {
    console.error('❌ User pengurus belum lengkap di-seed. Jalankan dulu: npm run seed')
    process.exit(1)
  }

  // ── 1. NEWS ARTICLES ────────────────────────────────────────
  const newsTitles = await existingTitles('news_articles')
  const newsDefs = [
    {
      title: 'Ramadhan Ceria di SDIT LHI — Pesantren Kilat Penuh Berkah',
      excerpt: 'Kegiatan pesantren kilat Ramadhan di SDIT LHI dipenuhi tilawah, tahfidz, dan keceriaan.',
      content: '## Sambutan Hangat\n\nSelama bulan Ramadhan, **SDIT LHI** menyelenggarakan pesantren kilat untuk siswa kelas 4-6...\n\n### Kegiatan Harian\n\n- Tilawah pagi bersama wali halaqoh\n- Setoran tahfidz juz 30\n- Buka puasa bersama\n\n*Alhamdulillah*, antusiasme siswa luar biasa.',
      thumbnail_url: 'https://images.unsplash.com/photo-1564769625905-50f0ca84d23e?w=1200',
      category: 'sdit_lhi', type: 'berita', author_id: humas,
    },
    {
      title: 'Khataman Akbar Siswa SD — Wisuda Tahfidz Juz 30',
      excerpt: '12 siswa SD LHI berhasil khataman juz 30 dan diwisuda dalam acara khataman akbar.',
      content: '## Wisuda Tahfidz\n\nSebanyak **12 siswa SDIT LHI** dinyatakan lulus hafalan juz 30 dalam acara wisuda...\n\n> Semoga menjadi generasi Qur\'ani yang bermanfaat.',
      thumbnail_url: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=1200',
      category: 'sdit_lhi', type: 'berita', author_id: kepala,
    },
    {
      title: 'Workshop Tahsin Metode Tilawati untuk Guru',
      excerpt: 'Para guru RQ LHI mengikuti workshop intensif metode Tilawati selama dua hari.',
      content: '## Penguatan Kompetensi\n\nWorkshop ini bertujuan menyamakan standar pembelajaran tahsin...\n\n- Hari 1: Konsep dasar Tilawati\n- Hari 2: Praktik mengajar jilid 1-6',
      thumbnail_url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200',
      category: null, type: 'artikel', author_id: kepala,
    },
    {
      title: 'Prestasi Tahfidz Siswa SMPIT LHI di Tingkat Provinsi',
      excerpt: 'Tiga siswa SMPIT LHI meraih juara lomba MHQ tingkat Provinsi DIY.',
      content: '## Membanggakan!\n\nAlhamdulillah, **tiga siswa SMPIT LHI** kembali mengukir prestasi...\n\n1. Juara 1: 10 Juz — Ananda A\n2. Juara 2: 5 Juz — Ananda B\n3. Harapan 1: 3 Juz — Ananda C',
      thumbnail_url: 'https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=1200',
      category: 'smpit_lhi', type: 'berita', author_id: humas,
    },
    {
      title: 'PAUD LHI Buka Pendaftaran Tahun Ajaran Baru',
      excerpt: 'Pendaftaran siswa baru PAUD LHI tahun ajaran 2026/2027 resmi dibuka.',
      content: '## Pendaftaran Dibuka!\n\n**PAUD LHI** menerima pendaftaran siswa baru untuk tahun ajaran 2026/2027...\n\n### Syarat\n- Usia 3-5 tahun\n- Mengisi formulir online\n\n### Jadwal\n- Pendaftaran: 1 Juni – 30 Juni 2026',
      thumbnail_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200',
      category: 'paud_lhi', type: 'berita', author_id: humas,
    },
    {
      title: 'Kiat Membangun Generasi Qur\'ani Sejak Dini',
      excerpt: 'Refleksi Kepala RQ tentang pentingnya membangun fondasi Al-Qur\'an sejak usia dini.',
      content: '## Pengantar\n\nGenerasi Qur\'ani lahir dari **kebiasaan harian**, bukan kebetulan...\n\n> "Anak adalah amanah, dan Al-Qur\'an adalah pewaris terbaik."\n\n### Tiga Pilar\n1. Keteladanan orang tua\n2. Komunitas pembelajaran\n3. Lingkungan pendukung',
      thumbnail_url: null,
      category: null, type: 'artikel', author_id: kepala,
    },
  ]
  const newsToInsert = newsDefs.filter(n => !newsTitles.has(n.title))
  if (newsToInsert.length > 0) {
    const { error } = await supabase.from('news_articles').insert(newsToInsert)
    if (error) console.error('  ✗ news:', error.message)
    else console.log(`  ✓ ${newsToInsert.length} news/artikel`)
  } else console.log('  · news sudah lengkap')

  // ── 2. PUBLIC POSTS ──────────────────────────────────────────
  const ppTitles = await existingTitles('public_posts')
  const ppDefs = [
    {
      type: 'pengumuman', target: 'all',
      title: 'Libur Idul Fitri 1447H — RQ LHI Tutup 8-15 April',
      content: 'Diberitahukan kepada seluruh wali murid dan staf, RQ LHI akan **libur Idul Fitri** mulai 8-15 April 2026. Kegiatan normal kembali tanggal 16 April. *Taqabbalallahu minna wa minkum.*',
      created_by: kepala,
    },
    {
      type: 'tugas_guru', target: 'sd',
      title: 'Setoran tahfidz harian minimal 5 ayat',
      content: 'Mohon kepada para wali halaqoh **SD** untuk memastikan setiap siswa setor minimal **5 ayat hafalan baru** per hari. Catat di portal guru. Target khatam juz 30 sebelum kenaikan kelas.',
      due_date: isoDate(daysAhead(30)),
      created_by: koorSd,
    },
    {
      type: 'tugas_guru', target: 'smp',
      title: 'Persiapan ujian tahfidz akhir semester',
      content: 'Wali halaqoh **SMP** mohon menyusun jadwal mock-ujian untuk siswa tingkat 8-9. Format ujian: setor 1 juz penuh + tajwid lisan. Deadline persiapan: 2 minggu sebelum ujian resmi.',
      due_date: isoDate(daysAhead(14)),
      created_by: koorSmp,
    },
    {
      type: 'pengumuman', target: 'all',
      title: 'Rapat akbar pengurus — Sabtu pekan ini',
      content: 'Mengundang seluruh pengurus RQ LHI untuk hadir **Rapat Akbar** Sabtu 14 Juni, pukul 09.00–12.00 di Aula Utama. Agenda: evaluasi semester & program tahun depan.',
      created_by: kepala,
    },
  ]
  const ppToInsert = ppDefs.filter(p => !ppTitles.has(p.title))
  if (ppToInsert.length > 0) {
    const { error } = await supabase.from('public_posts').insert(ppToInsert)
    if (error) console.error('  ✗ public_posts:', error.message)
    else console.log(`  ✓ ${ppToInsert.length} pengumuman/tugas guru`)
  } else console.log('  · public_posts sudah lengkap')

  // ── 3. RAPAT + FOLLOW-UP TASKS ──────────────────────────────
  const meetingSubject = 'Rapat Manajemen — Evaluasi Tengah Semester'
  const { data: existingMeeting } = await supabase
    .from('meetings').select('id').eq('subject', meetingSubject).maybeSingle()

  let meetingId = existingMeeting?.id as string | undefined
  if (!meetingId) {
    const { data: m, error } = await supabase.from('meetings').insert({
      type: 'manajemen', subject: meetingSubject,
      date: isoDate(daysAgo(7)), start_time: '09:00', end_time: '11:00',
      location: 'Aula RQ LHI', mc: 'Kumik', notulis: 'SDM',
      participants: ['Kepala RQ', 'Kumik', 'SDM', 'Bendahara'],
      created_by: kepala,
    }).select('id').single()
    if (error || !m) { console.error('  ✗ meeting:', error?.message) }
    else {
      meetingId = m.id
      console.log('  ✓ rapat manajemen')
    }
  } else {
    console.log('  · rapat manajemen sudah ada')
  }

  if (meetingId) {
    const { data: existingAgenda } = await supabase
      .from('agenda_items').select('id').eq('meeting_id', meetingId).limit(1)
    if (!existingAgenda || existingAgenda.length === 0) {
      const { data: agenda } = await supabase.from('agenda_items').insert([
        { meeting_id: meetingId, order_num: 1, tag: 'hasil_diskusi', discussion: 'Evaluasi capaian tahfidz semester 1 — target 80% terlampaui.', follow_up: null },
        { meeting_id: meetingId, order_num: 2, tag: 'tindak_lanjut', discussion: 'Perlu sinkronisasi jadwal ujian akhir antar koor.', follow_up: 'Susun draft jadwal terpadu' },
        { meeting_id: meetingId, order_num: 3, tag: 'keputusan', discussion: 'Anggaran ekstrakurikuler ditambah 15%.', follow_up: 'Bendahara siapkan revisi RAB' },
      ]).select('id, order_num')
      console.log(`  ✓ ${agenda?.length ?? 0} agenda items`)

      // Follow-up tasks (source_type='rapat')
      const followUpTasks = [
        {
          title: 'Susun draft jadwal ujian akhir terpadu', source_type: 'rapat',
          source_meeting_id: meetingId, source_agenda_id: agenda?.[1]?.id,
          assigned_by: kepala, assigned_to: kumik, priority: 'mendesak', status: 'in_progress',
          due_date: isoDate(daysAhead(7)),
        },
        {
          title: 'Revisi RAB ekstrakurikuler (+15%)', source_type: 'rapat',
          source_meeting_id: meetingId, source_agenda_id: agenda?.[2]?.id,
          assigned_by: kepala, assigned_to: bendahara, priority: 'normal', status: 'todo',
          due_date: isoDate(daysAhead(14)),
        },
      ]
      for (const t of followUpTasks) {
        const { data: created } = await supabase.from('tasks').insert(t).select('id').single()
        if (created) await supabase.from('task_history').insert({
          task_id: created.id, changed_by: t.assigned_by, old_status: null, new_status: 'todo', notes: 'Task dibuat dari follow-up rapat (demo)',
        })
      }
      console.log(`  ✓ ${followUpTasks.length} follow-up tasks dari rapat`)
    }
  }

  // ── 4. TUGAS TAMBAHAN per role ──────────────────────────────
  const taskTitles = await existingTitles('tasks')
  const moreTasks: Record<string, unknown>[] = [
    // Pribadi panjang
    { title: 'Petakan ulang struktur kurikulum tahfidz 3 tahun', source_type: 'mandiri', priority: 'jangka_panjang', assigned_by: kumik, assigned_to: kumik, status: 'in_progress' },
    { title: 'Rencana rekrutmen guru baru tahun ajaran depan',  source_type: 'mandiri', priority: 'jangka_panjang', assigned_by: sdm,   assigned_to: sdm,   status: 'todo' },
    { title: 'Rencana ekstrakurikuler semester baru',           source_type: 'mandiri', priority: 'jangka_panjang', assigned_by: koorEkstra!, assigned_to: koorEkstra!, status: 'todo' },
    // Pribadi pendek
    { title: 'Buat surat resmi ke yayasan', source_type: 'mandiri', priority: 'normal', assigned_by: kepala, assigned_to: kepala, status: 'in_progress' },
    { title: 'Approve jadwal halaqoh Koor SD pekan ini', source_type: 'mandiri', priority: 'normal', assigned_by: kumik, assigned_to: kumik, status: 'todo' },
    { title: 'Update database guru (kontak & status aktif)', source_type: 'mandiri', priority: 'normal', assigned_by: sdm, assigned_to: sdm, status: 'in_progress' },
    // Delegasi (penugasan atasan)
    { title: 'Susun proposal pelatihan guru kuartal 3',     source_type: 'mandiri', priority: 'mendesak', assigned_by: kepala, assigned_to: kumik, status: 'in_progress', due_date: isoDate(daysAhead(5)) },
    { title: 'Audit kepegawaian tahun berjalan',            source_type: 'mandiri', priority: 'normal',   assigned_by: kepala, assigned_to: sdm,    status: 'todo',         due_date: isoDate(daysAhead(21)) },
    { title: 'Laporan capaian tahfidz SD bulan ini',        source_type: 'mandiri', priority: 'normal',   assigned_by: kumik,  assigned_to: koorSd, status: 'submitted',    due_date: isoDate(daysAgo(2)) },
    { title: 'Susun jadwal mock-ujian SMP',                 source_type: 'mandiri', priority: 'mendesak', assigned_by: kumik,  assigned_to: koorSmp, status: 'in_progress', due_date: isoDate(daysAhead(7)) },
    { title: 'Buat poster acara wisuda tahfidz',            source_type: 'mandiri', priority: 'normal',   assigned_by: koorEkstra!, assigned_to: humas, status: 'in_progress', due_date: isoDate(daysAhead(10)) },
    { title: 'Rekap pengeluaran operasional bulan ini',     source_type: 'mandiri', priority: 'normal',   assigned_by: kepala, assigned_to: bendahara, status: 'done',     verified_by: kepala, verified_at: new Date().toISOString() },
  ]
  const newTasks = moreTasks.filter(t => !taskTitles.has(t.title as string))
  let inserted = 0
  for (const t of newTasks) {
    const { data: created, error } = await supabase.from('tasks').insert(t).select('id').single()
    if (error || !created) { console.error(`  ✗ task "${t.title}":`, error?.message); continue }
    await supabase.from('task_history').insert({
      task_id: created.id, changed_by: t.assigned_by, old_status: null, new_status: 'todo', notes: 'Task dibuat (demo)',
    })
    inserted++
  }
  console.log(`  ✓ ${inserted} tasks tambahan${newTasks.length - inserted > 0 ? ` (${newTasks.length - inserted} skipped/error)` : ''}`)

  // ── 5. CONTENT REQUESTS (Humas) ─────────────────────────────
  const crDescs = await existingTitles('content_requests', 'description')
  const crDefs = [
    { request_type: 'flyer_ujian', description: 'Flyer ujian tengah semester SD',     requested_by: koorSd,     requested_date: isoDate(daysAgo(5)), priority: 'high',   status: 'on_process' },
    { request_type: 'video',        description: 'Video pendek setoran tahfidz harian', requested_by: humas,      requested_date: isoDate(daysAgo(3)), priority: 'medium', status: 'requested' },
    { request_type: 'flyer_lain',   description: 'Flyer pendaftaran PAUD LHI',         requested_by: humas,      requested_date: isoDate(daysAgo(2)), priority: 'high',   status: 'requested' },
  ]
  const crToInsert = crDefs.filter(c => !crDescs.has(c.description))
  if (crToInsert.length > 0) {
    const { error } = await supabase.from('content_requests').insert(crToInsert)
    if (error) console.error('  ✗ content_requests:', error.message)
    else console.log(`  ✓ ${crToInsert.length} content requests`)
  } else console.log('  · content requests sudah lengkap')

  // ── 6. PRIVATE NOTE (Bendahara) ─────────────────────────────
  if (bendahara) {
    const noteTitle = 'Kas RQ Mei 2026'
    const { data: existingNote } = await supabase
      .from('private_notes').select('id').eq('user_id', bendahara).eq('title', noteTitle).maybeSingle()
    if (!existingNote) {
      await supabase.from('private_notes').insert({
        user_id: bendahara, title: noteTitle,
        content: `## Ringkasan Kas\n\n- Saldo awal: Rp 12.500.000\n- Pemasukan: Rp 4.200.000\n- Pengeluaran: Rp 3.150.000\n- **Saldo akhir: Rp 13.550.000**\n\n*Catatan pribadi bendahara — tidak terlihat user lain.*`,
      })
      console.log('  ✓ private note bendahara')
    } else {
      console.log('  · private note sudah ada')
    }
  }

  console.log('\n✅ Seed konten demo selesai.')
  console.log('Coba:')
  console.log('  • Beranda (logout dulu): muncul berita & tugas guru SD/SMP')
  console.log('  • Login kepala_rq → /tasks → semua bucket terisi, /tasks/matrix penuh')
  console.log('  • Login kepala_rq → /rapat → muncul rapat manajemen + agenda')
  console.log('  • Login humas → /humas-request → ada 3 request')
  console.log('  • Login bendahara → /notes → ada 1 catatan kas')
}

main().catch(err => { console.error('Seed gagal:', err); process.exit(1) })
