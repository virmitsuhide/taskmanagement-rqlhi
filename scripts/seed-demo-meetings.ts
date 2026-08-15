/**
 * Seed 1 rapat demo untuk SETIAP jenis rapat (tab di /rapat).
 * Idempotent — jenis yang sudah punya rapat akan dilewati.
 *
 * Jalankan: npm run seed:demo:meetings
 *
 * Mengisi per jenis:
 *  - 1 meeting (subjek, tanggal, jam, lokasi, MC, notulis, peserta)
 *  - 3–4 agenda item dengan tag beragam
 *    (keputusan / informasi / perlu_diskusi / tindak_lanjut / approval)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import type { MeetingType, UserRole, AgendaTag } from '../types'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d) }

interface AgendaSeed {
  tag: AgendaTag
  discussion: string
  follow_up: string | null
}

interface MeetingSeed {
  type: MeetingType
  /** Role pembuat rapat — mengikuti MEETING_CREATE di lib/auth/permissions.ts */
  creatorRole: UserRole
  subject: string
  daysAgo: number
  start_time: string
  end_time: string
  location: string
  mc: string
  notulis: string
  participants: string[]
  agenda: AgendaSeed[]
}

const SEEDS: MeetingSeed[] = [
  {
    type: 'manajemen',
    creatorRole: 'kepala_rq',
    subject: 'Rapat Manajemen — Persiapan Semester Ganjil',
    daysAgo: 7,
    start_time: '09:00', end_time: '11:00',
    location: 'Ruang Manajemen RQ LHI',
    mc: 'Kumik', notulis: 'SDM',
    participants: ['Kepala RQ', 'Kumik', 'SDM', 'Bendahara'],
    agenda: [
      { tag: 'informasi', discussion: 'Paparan capaian semester genap: target hafalan tercapai 82% dari rencana awal.', follow_up: null },
      { tag: 'keputusan', discussion: 'Kalender akademik semester ganjil disepakati mulai 1 September, dengan pekan evaluasi di minggu ke-8.', follow_up: 'SDM menyusun draft kalender final pekan depan.' },
      { tag: 'tindak_lanjut', discussion: 'Anggaran operasional semester ganjil perlu direvisi mengikuti penambahan halaqoh baru.', follow_up: 'Bendahara mengajukan revisi RAB paling lambat akhir bulan.' },
      { tag: 'approval', discussion: 'Penggunaan anggaran: pengadaan 40 buku UMMI jilid 3 senilai Rp 1.200.000 diajukan Kumik — **disetujui** Kepala RQ, dicairkan lewat Bendahara.', follow_up: null },
    ],
  },
  {
    type: 'kumik',
    creatorRole: 'kumik',
    subject: 'Rapat Kumik — Evaluasi Kurikulum Tahsin',
    daysAgo: 12,
    start_time: '13:00', end_time: '15:00',
    location: 'Aula RQ LHI',
    mc: 'Koor SD', notulis: 'Koor SMP',
    participants: ['Kumik', 'Koor SD', 'Koor SMP', 'Koor Ekstra'],
    agenda: [
      { tag: 'perlu_diskusi', discussion: 'Metode UMMI jilid 3 dinilai terlalu cepat untuk kelas SD bawah; perlu penambahan sesi drill.', follow_up: null },
      { tag: 'keputusan', discussion: 'Sesi drill tambahan 15 menit ditambahkan pada halaqoh SD kelas 1–2 mulai pekan depan.', follow_up: 'Koor SD menyosialisasikan ke seluruh wali halaqoh.' },
      { tag: 'tindak_lanjut', discussion: 'Perlu rekap nilai fashohah per jilid untuk bahan evaluasi berikutnya.', follow_up: 'Koor SMP menyiapkan rekap sebelum rapat bulan depan.' },
    ],
  },
  {
    type: 'new_squad',
    creatorRole: 'sdm',
    subject: 'Rapat New Squad — Orientasi Anggota Baru',
    daysAgo: 20,
    start_time: '15:30', end_time: '17:00',
    location: 'Ruang Training RQ LHI',
    mc: 'Div Training', notulis: 'New Squad',
    participants: ['SDM', 'Div Training', 'New Squad'],
    agenda: [
      { tag: 'informasi', discussion: 'Pengenalan struktur organisasi RQ LHI dan alur pelaporan tugas melalui sistem.', follow_up: null },
      { tag: 'keputusan', discussion: 'Masa orientasi ditetapkan 4 pekan dengan pendampingan mentor dari Div Training.', follow_up: 'Div Training menyusun jadwal mentoring per anggota.' },
      { tag: 'perlu_diskusi', discussion: 'Anggota baru mengusulkan sesi sharing mingguan untuk membahas kendala lapangan.', follow_up: null },
      { tag: 'approval', discussion: 'Alokasi SDM: permintaan 2 mentor tambahan dari Div Training untuk pendampingan angkatan baru — **disetujui** dengan catatan evaluasi setelah 4 pekan.', follow_up: null },
    ],
  },
  {
    type: 'koor_sd',
    creatorRole: 'koor_sd',
    subject: 'Rapat Koor SD — Persiapan Ujian Kenaikan Jilid',
    daysAgo: 5,
    start_time: '10:00', end_time: '11:30',
    location: 'Ruang Koordinator SD',
    mc: 'Koor SD', notulis: 'Koor SD',
    participants: ['Koor SD', 'Wali Halaqoh SD'],
    agenda: [
      { tag: 'informasi', discussion: '38 siswa SD dinyatakan siap mengikuti ujian kenaikan jilid periode ini.', follow_up: null },
      { tag: 'keputusan', discussion: 'Ujian kenaikan jilid dilaksanakan dua hari, dibagi per level jilid untuk menghindari antrean panjang.', follow_up: 'Koor SD membuat jadwal penguji per sesi.' },
      { tag: 'tindak_lanjut', discussion: 'Siswa yang belum tuntas perlu program remedial terjadwal.', follow_up: 'Wali halaqoh mendata siswa remedial pekan ini.' },
    ],
  },
  {
    type: 'koor_smp',
    creatorRole: 'koor_smp',
    subject: 'Rapat Koor SMP — Target Tahfidz Juz 30',
    daysAgo: 9,
    start_time: '14:00', end_time: '15:30',
    location: 'Ruang Koordinator SMP',
    mc: 'Koor SMP', notulis: 'Koor SMP',
    participants: ['Koor SMP', 'Wali Halaqoh SMP'],
    agenda: [
      { tag: 'perlu_diskusi', discussion: 'Capaian tahfidz juz 30 baru 64%; kendala terbesar pada konsistensi murojaah harian.', follow_up: null },
      { tag: 'keputusan', discussion: 'Murojaah wajib dicatat di buku mutabaah dan diperiksa wali halaqoh setiap pekan.', follow_up: 'Koor SMP menyiapkan format buku mutabaah baru.' },
      { tag: 'tindak_lanjut', discussion: 'Perlu sesi tasmi bulanan untuk mengukur kualitas hafalan secara berkala.', follow_up: 'Koor SMP menjadwalkan tasmi perdana bulan depan.' },
    ],
  },
]

async function main() {
  console.log('🌱 Seed rapat demo dimulai...\n')

  // Peta role → user id
  const { data: users, error: userErr } = await supabase.from('users').select('id, role')
  if (userErr) throw userErr
  const userByRole = new Map<string, string>()
  for (const u of users ?? []) userByRole.set(u.role, u.id)

  // Jenis rapat yang sudah punya data → dilewati
  const { data: existing, error: existErr } = await supabase.from('meetings').select('type')
  if (existErr) throw existErr
  const typesWithData = new Set((existing ?? []).map(m => m.type))

  for (const seed of SEEDS) {
    if (typesWithData.has(seed.type)) {
      console.log(`⏭️  ${seed.type.padEnd(10)} — sudah ada rapat, dilewati`)
      continue
    }

    const createdBy = userByRole.get(seed.creatorRole)
    if (!createdBy) {
      console.log(`⚠️  ${seed.type.padEnd(10)} — user role "${seed.creatorRole}" tidak ditemukan, dilewati`)
      continue
    }

    const { data: meeting, error: meetErr } = await supabase
      .from('meetings')
      .insert({
        type: seed.type,
        subject: seed.subject,
        date: daysAgo(seed.daysAgo),
        start_time: seed.start_time,
        end_time: seed.end_time,
        location: seed.location,
        mc: seed.mc,
        notulis: seed.notulis,
        participants: seed.participants,
        created_by: createdBy,
      })
      .select('id')
      .single()

    if (meetErr || !meeting) {
      console.error(`❌ ${seed.type.padEnd(10)} — gagal insert rapat:`, meetErr)
      continue
    }

    const { error: agendaErr } = await supabase.from('agenda_items').insert(
      seed.agenda.map((a, i) => ({
        meeting_id: meeting.id,
        order_num: i + 1,
        tag: a.tag,
        discussion: a.discussion,
        follow_up: a.follow_up,
      })),
    )
    if (agendaErr) console.error(`❌ ${seed.type.padEnd(10)} — gagal insert agenda:`, agendaErr)

    console.log(`✅ ${seed.type.padEnd(10)} — "${seed.subject}" (${seed.agenda.length} agenda)`)
  }

  console.log('\n🎉 Selesai.')
}

main().catch(e => { console.error(e); process.exit(1) })
