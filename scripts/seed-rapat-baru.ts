/**
 * Data dummy untuk jenis rapat baru:
 *   • Rapat Koor x SD        (dibuat koor SD)
 *   • Rapat Koor x SMP       (dibuat koor SMP)
 *   • Rapat Koor x Boarding  (dibuat koor SMP)
 *   • Rapat RQ x QULS        (dibuat kumik)
 *
 * Jalankan:  npx tsx scripts/seed-rapat-baru.ts
 *
 * ⚠️ Prasyarat: drizzle/0012_meeting_types_koor_x_quls_PASTE_TO_SUPABASE.sql
 *    sudah dijalankan di Supabase. Tanpa itu insert gagal dengan
 *    "invalid input value for enum meeting_type".
 *
 * Idempoten: rapat yang subject + tanggalnya sudah ada akan dilewati.
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

type AgendaTag = 'keputusan' | 'informasi' | 'perlu_diskusi' | 'tindak_lanjut' | 'approval'

interface SeedAgenda {
  tag: AgendaTag
  discussion: string
  follow_up?: string
}

interface SeedMeeting {
  type: 'koor_x_sd' | 'koor_x_smp' | 'koor_x_boarding' | 'rq_x_quls'
  /** username pembuat — dipetakan ke users.id saat runtime */
  creator: string
  subject: string
  date: string
  start_time: string
  end_time: string
  location: string
  mc: string
  notulis: string
  participants: string[]
  agenda: SeedAgenda[]
}

const MEETINGS: SeedMeeting[] = [
  // ── Rapat Koor x SD ────────────────────────────────────────────────
  {
    type: 'koor_x_sd',
    creator: 'koor_sd',
    subject: 'Evaluasi Capaian Tahfidz Semester Ganjil SD',
    date: '2026-07-14',
    start_time: '09:00',
    end_time: '11:00',
    location: 'Ruang Rapat Utama RQ LHI',
    mc: 'Ust. Faiz',
    notulis: 'Ustzh. Nabila',
    participants: ['Koor SD', 'Ust. Faiz', 'Ustzh. Nabila', 'Ustzh. Salma', 'Ust. Ridwan'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Capaian hafalan kelas 4–6 rata-rata 3,5 juz, sedikit di bawah target semester (4 juz). Kelas 1–3 justru melampaui target dengan rata-rata 1,8 juz.',
      },
      {
        tag: 'perlu_diskusi',
        discussion:
          'Jam halaqoh sore sering terpotong kegiatan ekstrakurikuler, terutama Selasa dan Kamis. Perlu penyelarasan jadwal dengan Koor Ekstra.',
        follow_up: 'Koor SD menjadwalkan koordinasi dengan Koor Ekstra pekan depan.',
      },
      {
        tag: 'keputusan',
        discussion:
          'Disepakati menambah satu sesi murojaah pekanan setiap Sabtu pagi khusus kelas 5–6 untuk mengejar target hafalan.',
      },
      {
        tag: 'tindak_lanjut',
        discussion: 'Penyusunan rapor tahfidz semester ganjil.',
        follow_up: 'Draft rapor selesai paling lambat 25 Juli 2026, diserahkan ke wali kelas.',
      },
    ],
  },
  {
    type: 'koor_x_sd',
    creator: 'koor_sd',
    subject: 'Persiapan Ujian Kenaikan Juz Tingkat SD',
    date: '2026-08-04',
    start_time: '13:30',
    end_time: '15:00',
    location: 'Ruang Kelas 6A',
    mc: 'Ustzh. Salma',
    notulis: 'Ust. Ridwan',
    participants: ['Koor SD', 'Ustzh. Salma', 'Ust. Ridwan', 'Ust. Faiz'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Total 48 siswa mendaftar ujian kenaikan juz: 21 siswa juz 30, 15 siswa juz 29, dan 12 siswa juz 28.',
      },
      {
        tag: 'keputusan',
        discussion:
          'Ujian dilaksanakan dua gelombang, 18 dan 19 Agustus 2026, agar setiap penguji maksimal menguji 12 siswa per hari.',
      },
      {
        tag: 'approval',
        discussion:
          'Pengajuan konsumsi dan sertifikat ujian sebesar Rp1.850.000 diajukan ke bendahara.',
        follow_up: 'Menunggu persetujuan bendahara sebelum 12 Agustus 2026.',
      },
    ],
  },

  // ── Rapat Koor x SMP ───────────────────────────────────────────────
  {
    type: 'koor_x_smp',
    creator: 'koor_smp',
    subject: 'Penyesuaian Kurikulum Tahsin SMP Tahun Ajaran Baru',
    date: '2026-07-21',
    start_time: '10:00',
    end_time: '12:00',
    location: 'Ruang Rapat Utama RQ LHI',
    mc: 'Ust. Hanif',
    notulis: 'Ustzh. Aisyah',
    participants: ['Koor SMP', 'Ust. Hanif', 'Ustzh. Aisyah', 'Ust. Yusuf'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Hasil placement test menunjukkan 34% siswa baru masih di level UMMI jilid 3–4, lebih tinggi dari tahun lalu (22%).',
      },
      {
        tag: 'perlu_diskusi',
        discussion:
          'Perlu penambahan satu kelompok tahsin dasar, namun ketersediaan ustadz pengampu masih terbatas.',
        follow_up: 'Koor SMP mengajukan kebutuhan pengampu tambahan ke SDM.',
      },
      {
        tag: 'keputusan',
        discussion:
          'Pembagian kelompok tahsin dibuat per level, bukan per kelas, mulai tahun ajaran 2026/2027.',
      },
    ],
  },
  {
    type: 'koor_x_smp',
    creator: 'koor_smp',
    subject: 'Evaluasi Kedisiplinan Halaqoh Sore SMP',
    date: '2026-08-11',
    start_time: '15:30',
    end_time: '17:00',
    location: 'Musholla Putra',
    mc: 'Ust. Yusuf',
    notulis: 'Ustzh. Aisyah',
    participants: ['Koor SMP', 'Ust. Yusuf', 'Ustzh. Aisyah', 'Ust. Hanif'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Tingkat kehadiran halaqoh sore bulan Juli 87%, turun dari 93% pada bulan Juni.',
      },
      {
        tag: 'perlu_diskusi',
        discussion:
          'Sebagian besar keterlambatan terjadi pada hari Senin, bertepatan dengan jadwal pulang sekolah formal yang lebih sore.',
      },
      {
        tag: 'tindak_lanjut',
        discussion: 'Sosialisasi ulang tata tertib halaqoh kepada wali santri.',
        follow_up: 'Surat pemberitahuan dikirim via wali kelas paling lambat 20 Agustus 2026.',
      },
    ],
  },

  // ── Rapat Koor x Boarding ──────────────────────────────────────────
  {
    type: 'koor_x_boarding',
    creator: 'koor_smp',
    subject: 'Koordinasi Program Tahfidz Santri Boarding',
    date: '2026-07-28',
    start_time: '19:30',
    end_time: '21:00',
    location: 'Aula Asrama Putra',
    mc: 'Ust. Ammar',
    notulis: 'Ust. Yusuf',
    participants: ['Koor SMP', 'Ust. Ammar', 'Ust. Yusuf', 'Musyrif Asrama Putra', 'Musyrifah Asrama Putri'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Santri boarding aktif berjumlah 62 orang: 35 putra dan 27 putri, tersebar di 8 halaqoh.',
      },
      {
        tag: 'keputusan',
        discussion:
          'Program ziyadah bakda Subuh ditetapkan wajib bagi seluruh santri boarding, dengan durasi 45 menit.',
      },
      {
        tag: 'perlu_diskusi',
        discussion:
          'Kualitas tidur santri terganggu karena murojaah malam berakhir terlalu larut. Perlu evaluasi jadwal malam.',
        follow_up: 'Musyrif menyusun usulan jadwal baru untuk dibahas rapat berikutnya.',
      },
    ],
  },
  {
    type: 'koor_x_boarding',
    creator: 'koor_smp',
    subject: 'Evaluasi Fasilitas dan Kesehatan Asrama',
    date: '2026-08-13',
    start_time: '19:30',
    end_time: '20:45',
    location: 'Aula Asrama Putra',
    mc: 'Musyrif Asrama Putra',
    notulis: 'Ust. Ammar',
    participants: ['Koor SMP', 'Ust. Ammar', 'Musyrif Asrama Putra', 'Musyrifah Asrama Putri'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Tercatat 9 santri izin sakit sepanjang Juli, mayoritas keluhan batuk dan demam ringan.',
      },
      {
        tag: 'approval',
        discussion:
          'Pengajuan perbaikan dua unit kamar mandi asrama putri senilai Rp4.200.000.',
        follow_up: 'Diteruskan ke bendahara dan kepala RQ untuk persetujuan anggaran.',
      },
      {
        tag: 'tindak_lanjut',
        discussion: 'Penjadwalan pemeriksaan kesehatan rutin santri boarding.',
        follow_up: 'Koordinasi dengan klinik mitra, target pelaksanaan awal September 2026.',
      },
    ],
  },

  // ── Rapat RQ x QULS ────────────────────────────────────────────────
  {
    type: 'rq_x_quls',
    creator: 'kumik',
    subject: 'Sinkronisasi Program RQ LHI dan QULS',
    date: '2026-07-30',
    start_time: '09:30',
    end_time: '11:30',
    location: 'Ruang Rapat Utama RQ LHI',
    mc: 'Kumik',
    notulis: 'SDM',
    participants: ['Kepala RQ', 'Kumik', 'SDM', 'Bendahara', 'Perwakilan QULS'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'QULS memaparkan rencana program sertifikasi guru Qur\'an angkatan ke-3 yang dibuka September 2026.',
      },
      {
        tag: 'perlu_diskusi',
        discussion:
          'Skema pembiayaan sertifikasi: ditanggung penuh RQ, subsidi sebagian, atau mandiri oleh peserta.',
        follow_up: 'Bendahara menghitung simulasi tiga skema untuk rapat berikutnya.',
      },
      {
        tag: 'keputusan',
        discussion:
          'RQ LHI mengirim 6 ustadz/ustadzah pada angkatan ke-3, diprioritaskan pengampu halaqoh inti.',
      },
    ],
  },
  {
    type: 'rq_x_quls',
    creator: 'kumik',
    subject: 'Evaluasi Kerja Sama QULS Semester Berjalan',
    date: '2026-08-15',
    start_time: '13:00',
    end_time: '15:00',
    location: 'Ruang Rapat Utama RQ LHI',
    mc: 'Kumik',
    notulis: 'SDM',
    participants: ['Kepala RQ', 'Kumik', 'SDM', 'Bendahara', 'Perwakilan QULS'],
    agenda: [
      {
        tag: 'informasi',
        discussion:
          'Dari 6 peserta yang dikirim, 5 telah menyelesaikan modul dasar dan 1 menunda karena alasan kesehatan.',
      },
      {
        tag: 'approval',
        discussion:
          'Pelunasan biaya kerja sama tahap kedua sebesar Rp12.500.000 kepada QULS.',
        follow_up: 'Menunggu persetujuan kepala RQ sebelum akhir Agustus 2026.',
      },
      {
        tag: 'tindak_lanjut',
        discussion: 'Penyusunan laporan dampak program terhadap kualitas halaqoh.',
        follow_up: 'SDM menyiapkan laporan sebelum rapat manajemen bulan depan.',
      },
    ],
  },
]

async function main() {
  const { data: users, error: userErr } = await supabase.from('users').select('id, username')
  if (userErr) throw new Error(`Gagal memuat users: ${userErr.message}`)

  const userIdByName = new Map((users ?? []).map(u => [u.username as string, u.id as string]))

  let inserted = 0
  let skipped = 0

  for (const m of MEETINGS) {
    const createdBy = userIdByName.get(m.creator)
    if (!createdBy) {
      console.warn(`⚠️  User "${m.creator}" tidak ditemukan — "${m.subject}" dilewati.`)
      skipped++
      continue
    }

    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('type', m.type)
      .eq('subject', m.subject)
      .eq('date', m.date)
      .maybeSingle()

    if (existing) {
      console.log(`↷  Sudah ada: ${m.subject}`)
      skipped++
      continue
    }

    const { data: meeting, error: insErr } = await supabase
      .from('meetings')
      .insert({
        type: m.type,
        subject: m.subject,
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        location: m.location,
        mc: m.mc,
        notulis: m.notulis,
        participants: m.participants,
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (insErr || !meeting) {
      console.error(`✗  Gagal menyimpan "${m.subject}": ${insErr?.message}`)
      skipped++
      continue
    }

    const { error: agendaErr } = await supabase.from('agenda_items').insert(
      m.agenda.map((a, i) => ({
        meeting_id: meeting.id,
        order_num: i + 1,
        tag: a.tag,
        discussion: a.discussion,
        follow_up: a.follow_up ?? null,
      })),
    )

    if (agendaErr) {
      console.error(`✗  Rapat tersimpan tapi agenda gagal ("${m.subject}"): ${agendaErr.message}`)
    }

    console.log(`✓  ${m.type.padEnd(16)} ${m.subject} (${m.agenda.length} agenda)`)
    inserted++
  }

  console.log(`\nSelesai — ${inserted} rapat baru, ${skipped} dilewati.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
