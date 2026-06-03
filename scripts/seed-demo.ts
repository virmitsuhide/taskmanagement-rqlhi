/**
 * Seed data DEMO/DUMMY untuk test fitur lengkap.
 * Idempotent: aman dijalankan berulang (cek existing, skip jika ada).
 *
 * Jalankan: npm run seed:demo
 *
 * Mengisi:
 *  - 3 halaqoh (Abu Bakr SD, Khadijah SD, Umar SMP) dengan wali ust_ahmad/ust_fatimah/ust_yusuf
 *  - 12 siswa (4 per halaqoh) dengan posisi tahsin awal (Tilawati jilid bervariasi)
 *  - Setoran tahsin & tahfidz 14 hari terakhir (probabilistik ~70% setor)
 *  - 2 kenaikan jilid + 1 kenaikan juz
 *  - 6 tasks dari berbagai source/priority untuk kepala_rq & kumik
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
function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d }
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function chance(p: number): boolean { return Math.random() < p }
function int(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

async function main() {
  console.log('🌱 Seed demo dimulai...\n')

  // ── 1. Ambil referensi yang sudah ada ─────────────────────────
  const { data: teachers } = await supabase.from('teachers').select('id, username, full_name').in('username', ['ust_ahmad', 'ust_yusuf', 'ust_fatimah'])
  if (!teachers || teachers.length < 3) {
    console.error('❌ Guru demo belum ada. Jalankan dulu: npm run seed:teachers')
    process.exit(1)
  }
  const tAhmad = teachers.find(t => t.username === 'ust_ahmad')!
  const tFatimah = teachers.find(t => t.username === 'ust_fatimah')!
  const tYusuf = teachers.find(t => t.username === 'ust_yusuf')!

  const { data: tilawati } = await supabase.from('tahsin_methods').select('id, name').eq('name', 'Tilawati').maybeSingle()
  if (!tilawati) { console.error('❌ Metode Tilawati belum di-seed. Jalankan: npm run seed:phase0'); process.exit(1) }

  const { data: jilids } = await supabase.from('jilid_levels').select('id, label, order_num').eq('method_id', tilawati.id).order('order_num')
  if (!jilids || jilids.length === 0) { console.error('❌ Jilid Tilawati belum ada.'); process.exit(1) }
  const jilid1 = jilids.find(j => j.order_num === 1)!
  const jilid2 = jilids.find(j => j.order_num === 2)!
  const jilid3 = jilids.find(j => j.order_num === 3)!
  const jilid4 = jilids.find(j => j.order_num === 4)!
  const jilid5 = jilids.find(j => j.order_num === 5)!

  const { data: kepalaRq } = await supabase.from('users').select('id, username').in('username', ['kepala_rq', 'kumik', 'koor_sd', 'humas']).order('username')
  const adminMap = new Map((kepalaRq ?? []).map(u => [u.username, u.id]))

  // ── 2. Halaqoh ──────────────────────────────────────────────
  const halaqohDefs = [
    { name: 'Halaqoh Abu Bakr', jenjang: 'sd' as const, wali: tAhmad.id,   schedule_note: 'Senin–Jumat, 07:30–09:00' },
    { name: 'Halaqoh Khadijah', jenjang: 'sd' as const, wali: tFatimah.id, schedule_note: 'Senin–Jumat, 09:30–11:00' },
    { name: 'Halaqoh Umar',     jenjang: 'smp' as const, wali: tYusuf.id,   schedule_note: 'Senin–Jumat, 13:00–14:30' },
  ]

  const halaqohIds: Record<string, string> = {}
  for (const h of halaqohDefs) {
    const { data: existing } = await supabase.from('halaqoh').select('id').eq('name', h.name).maybeSingle()
    if (existing) {
      halaqohIds[h.name] = existing.id
      console.log(`  · halaqoh ${h.name} sudah ada`)
      continue
    }
    const { data, error } = await supabase.from('halaqoh').insert({
      name: h.name, jenjang: h.jenjang, wali_teacher_id: h.wali, schedule_note: h.schedule_note,
    }).select('id').single()
    if (error || !data) { console.error(`  ✗ ${h.name}: ${error?.message}`); continue }
    halaqohIds[h.name] = data.id
    console.log(`  ✓ halaqoh ${h.name}`)
  }

  // ── 3. Siswa ────────────────────────────────────────────────
  const studentDefs = [
    // Halaqoh Abu Bakr (SD, Ust Ahmad)
    { full_name: 'Muhammad Zaki Abdullah',  halaqoh: 'Halaqoh Abu Bakr', jenjang: 'sd', kelas: '4A', gender: 'L', jilid: jilid4, page: 18, wali_name: 'Abdullah Hidayat',    wali_phone: '081234560001' },
    { full_name: 'Aisyah Rahmah Az-Zahra',  halaqoh: 'Halaqoh Abu Bakr', jenjang: 'sd', kelas: '5A', gender: 'P', jilid: jilid5, page: 12, wali_name: 'Hasan Az-Zahra',      wali_phone: '081234560002' },
    { full_name: 'Umar Al-Faruq Maulana',   halaqoh: 'Halaqoh Abu Bakr', jenjang: 'sd', kelas: '4B', gender: 'L', jilid: jilid4, page: 8,  wali_name: 'Maulana Yusuf',       wali_phone: '081234560003' },
    { full_name: 'Hasan Nashir Ibrahim',    halaqoh: 'Halaqoh Abu Bakr', jenjang: 'sd', kelas: '3A', gender: 'L', jilid: jilid3, page: 24, wali_name: 'Ibrahim Nashir',      wali_phone: '081234560004' },
    // Halaqoh Khadijah (SD, Ust Fatimah)
    { full_name: 'Fatimah Maryam Saidah',   halaqoh: 'Halaqoh Khadijah', jenjang: 'sd', kelas: '5B', gender: 'P', jilid: jilid5, page: 6,  wali_name: 'Saidah Maryam',       wali_phone: '081234560005' },
    { full_name: 'Khadijah Aliyya Putri',   halaqoh: 'Halaqoh Khadijah', jenjang: 'sd', kelas: '6A', gender: 'P', jilid: jilids.find(j=>j.order_num===6)!, page: 4, wali_name: 'Putri Aliyya', wali_phone: '081234560006' },
    { full_name: 'Husna Salsabila',         halaqoh: 'Halaqoh Khadijah', jenjang: 'sd', kelas: '4A', gender: 'P', jilid: jilid4, page: 15, wali_name: 'Salsabila Husna',     wali_phone: '081234560007' },
    { full_name: 'Maryam Hanifah',          halaqoh: 'Halaqoh Khadijah', jenjang: 'sd', kelas: '3B', gender: 'P', jilid: jilid2, page: 30, wali_name: 'Hanifah Maryam',      wali_phone: '081234560008' },
    // Halaqoh Umar (SMP, Ust Yusuf)
    { full_name: 'Ali Bin Abi Thalib',      halaqoh: 'Halaqoh Umar',     jenjang: 'smp', kelas: '8A', gender: 'L', jilid: jilids.find(j=>j.order_num===7)!, page: null, wali_name: 'Abi Thalib',  wali_phone: '081234560009' },
    { full_name: 'Utsman Bin Affan',        halaqoh: 'Halaqoh Umar',     jenjang: 'smp', kelas: '7A', gender: 'L', jilid: jilid5, page: 22, wali_name: 'Affan',                wali_phone: '081234560010' },
    { full_name: 'Yusuf Hidayatullah',      halaqoh: 'Halaqoh Umar',     jenjang: 'smp', kelas: '7B', gender: 'L', jilid: jilid4, page: 11, wali_name: 'Hidayatullah',        wali_phone: '081234560011' },
    { full_name: 'Sumayyah Khaulah',        halaqoh: 'Halaqoh Umar',     jenjang: 'smp', kelas: '8B', gender: 'P', jilid: jilids.find(j=>j.order_num===6)!, page: 20, wali_name: 'Khaulah',     wali_phone: '081234560012' },
  ]

  const studentIds: Record<string, string> = {}
  for (let i = 0; i < studentDefs.length; i++) {
    const s = studentDefs[i]
    const nis = `2024-${(100 + i).toString().padStart(3, '0')}`
    const { data: existing } = await supabase.from('students').select('id').eq('nis', nis).maybeSingle()
    if (existing) {
      studentIds[s.full_name] = existing.id
      continue
    }
    const { data, error } = await supabase.from('students').insert({
      nis, full_name: s.full_name, gender: s.gender, jenjang: s.jenjang, kelas: s.kelas,
      halaqoh_id: halaqohIds[s.halaqoh], wali_name: s.wali_name, wali_phone: s.wali_phone,
      current_method_id: tilawati.id, current_jilid_id: s.jilid.id, current_jilid_page: s.page,
    }).select('id').single()
    if (error || !data) { console.error(`  ✗ siswa ${s.full_name}: ${error?.message}`); continue }
    studentIds[s.full_name] = data.id
  }
  console.log(`  ✓ ${Object.keys(studentIds).length} siswa siap`)

  // ── 4. Setoran tahsin & tahfidz 14 hari terakhir ─────────────
  // Cek apakah sudah ada log demo (lewat insertedAt range) — skip jika sudah banyak
  const { count: existingLogs } = await supabase.from('tahsin_logs').select('*', { count: 'exact', head: true })
  if ((existingLogs ?? 0) > 50) {
    console.log(`  · sudah ada ${existingLogs} tahsin_logs, skip insert log demo`)
  } else {
    const tahsinBatch: Record<string, unknown>[] = []
    const tahfidzBatch: Record<string, unknown>[] = []
    const teacherByHalaqoh: Record<string, string> = {
      'Halaqoh Abu Bakr': tAhmad.id,
      'Halaqoh Khadijah': tFatimah.id,
      'Halaqoh Umar': tYusuf.id,
    }

    // Surat-surat juz 30 untuk tahfidz
    const { data: surahJuz30 } = await supabase.from('surat_master').select('id, total_ayat').gte('id', 78).lte('id', 114)
    const juz30 = surahJuz30 ?? []

    for (let dayBack = 13; dayBack >= 0; dayBack--) {
      const d = daysAgo(dayBack)
      const dow = d.getDay()
      if (dow === 0 || dow === 6) continue // skip weekend

      for (const s of studentDefs) {
        if (!chance(0.7)) continue // ~70% kehadiran
        const studentId = studentIds[s.full_name]
        if (!studentId) continue
        const teacherId = teacherByHalaqoh[s.halaqoh]
        const halaqohId = halaqohIds[s.halaqoh]
        const dateStr = isoDate(d)

        // Tahsin
        tahsinBatch.push({
          student_id: studentId, teacher_id: teacherId, halaqoh_id: halaqohId,
          setoran_date: dateStr,
          method_id: tilawati.id, jilid_id: s.jilid.id, halaman: s.page ?? int(1, 30),
          baris_dari: 1, baris_ke: int(3, 5),
          nilai_fashohah: int(3, 5), nilai_tajwid: int(3, 5), nilai_kelancaran: int(3, 5),
          status: chance(0.85) ? 'lulus' : 'ulang',
          catatan: chance(0.3) ? rand(['Bagus, lanjutkan!', 'Perhatikan madd thabi\'i', 'Latih lagi makharijul huruf', 'Alhamdulillah lancar']) : null,
        })

        // Tahfidz (separuh siswa per hari)
        if (chance(0.5) && juz30.length > 0) {
          const surat = rand(juz30)
          const ayatDari = int(1, Math.max(1, surat.total_ayat - 5))
          const ayatKe = Math.min(surat.total_ayat, ayatDari + int(2, 5))
          tahfidzBatch.push({
            student_id: studentId, teacher_id: teacherId, halaqoh_id: halaqohId,
            setoran_date: dateStr,
            kind: chance(0.6) ? 'hafalan_baru' : 'murojaah',
            surat_id: surat.id, ayat_dari: ayatDari, ayat_ke: ayatKe,
            nilai_fashohah: int(3, 5), nilai_tajwid: int(3, 5), nilai_kelancaran: int(3, 5),
          })
        }
      }
    }

    if (tahsinBatch.length > 0) {
      const { error } = await supabase.from('tahsin_logs').insert(tahsinBatch)
      if (error) console.error('  ✗ tahsin batch:', error.message)
      else console.log(`  ✓ ${tahsinBatch.length} setoran tahsin`)
    }
    if (tahfidzBatch.length > 0) {
      const { error } = await supabase.from('tahfidz_logs').insert(tahfidzBatch)
      if (error) console.error('  ✗ tahfidz batch:', error.message)
      else console.log(`  ✓ ${tahfidzBatch.length} setoran tahfidz (trigger auto-update juz_progress)`)
    }
  }

  // ── 5. Kenaikan jilid (2x) & juz (1x) ────────────────────────
  const promoStudent1 = studentIds['Muhammad Zaki Abdullah']
  const promoStudent2 = studentIds['Hasan Nashir Ibrahim']
  if (promoStudent1) {
    await supabase.from('jilid_promotions').insert({
      student_id: promoStudent1, from_jilid_id: jilid3.id, to_jilid_id: jilid4.id,
      promoted_by: tAhmad.id, promotion_date: isoDate(daysAgo(12)), exam_score: 87,
      catatan: 'Lulus dengan baik',
    })
  }
  if (promoStudent2) {
    await supabase.from('jilid_promotions').insert({
      student_id: promoStudent2, from_jilid_id: jilid1.id, to_jilid_id: jilid2.id,
      promoted_by: tAhmad.id, promotion_date: isoDate(daysAgo(8)),
    })
  }
  const promoJuz = studentIds['Aisyah Rahmah Az-Zahra']
  if (promoJuz) {
    await supabase.from('juz_promotions').insert({
      student_id: promoJuz, juz_number: 30, promoted_by: tFatimah.id,
      promotion_date: isoDate(daysAgo(5)), exam_score: 92, catatan: 'Khatam juz 30 dengan baik',
    }).select() // ignore conflict
    await supabase.from('juz_progress').upsert({
      student_id: promoJuz, juz_number: 30, mutqin: true,
    }, { onConflict: 'student_id,juz_number' })
  }
  console.log('  ✓ kenaikan jilid & juz')

  // ── 6. Tasks demo ───────────────────────────────────────────
  const kepalaRqId = adminMap.get('kepala_rq')
  const kumikId = adminMap.get('kumik')
  const koorSdId = adminMap.get('koor_sd')
  const humasId = adminMap.get('humas')

  if (kepalaRqId && kumikId && koorSdId && humasId) {
    const { count: existingTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
    if ((existingTasks ?? 0) > 3) {
      console.log(`  · sudah ada ${existingTasks} tasks, skip seed task demo`)
    } else {
      const tasksToInsert: Record<string, unknown>[] = [
        // Personal kepala_rq jangka panjang
        { title: 'Susun Renstra RQ 2026-2030', source_type: 'mandiri', priority: 'jangka_panjang', assigned_by: kepalaRqId, assigned_to: kepalaRqId, status: 'in_progress', description: 'Rencana strategis 5 tahun untuk pengembangan RQ.' },
        // Personal kepala_rq jangka pendek
        { title: 'Review proposal pelatihan guru', source_type: 'mandiri', priority: 'normal', assigned_by: kepalaRqId, assigned_to: kepalaRqId, status: 'todo' },
        // Delegasi dari kepala_rq ke kumik (penugasan atasan)
        { title: 'Evaluasi kurikulum tahfidz semester ini', source_type: 'mandiri', priority: 'mendesak', assigned_by: kepalaRqId, assigned_to: kumikId, status: 'in_progress', due_date: isoDate(daysAgo(-3)) },
        // Delegasi dari kumik ke koor_sd
        { title: 'Susun jadwal halaqoh Ramadhan', source_type: 'mandiri', priority: 'mendesak', assigned_by: kumikId, assigned_to: koorSdId, status: 'todo', due_date: isoDate(daysAgo(-7)) },
        // Delegasi ke humas (selesai)
        { title: 'Buat flyer kegiatan akhir semester', source_type: 'mandiri', priority: 'normal', assigned_by: kumikId, assigned_to: humasId, status: 'done', verified_by: kumikId, verified_at: new Date().toISOString() },
        // Dari rapat (follow up) — butuh meeting_id, kita skip kalau tidak ada meeting; pakai source_type tetap mandiri dengan title hint
        { title: '[Follow up rapat manajemen] Sinkronisasi jadwal ujian akhir', source_type: 'mandiri', priority: 'normal', assigned_by: kepalaRqId, assigned_to: kumikId, status: 'submitted' },
      ]

      for (const t of tasksToInsert) {
        const { data: task } = await supabase.from('tasks').insert(t).select('id').single()
        if (task) {
          await supabase.from('task_history').insert({
            task_id: task.id, changed_by: t.assigned_by, old_status: null, new_status: 'todo', notes: 'Task dibuat (demo)',
          })
        }
      }
      console.log(`  ✓ ${tasksToInsert.length} tasks demo`)
    }
  } else {
    console.log('  · skip task: salah satu user (kepala_rq/kumik/koor_sd/humas) tidak ditemukan')
  }

  console.log('\n✅ Seed demo selesai.')
  console.log('Coba login:')
  console.log('  • Admin: kepala_rq / RQ@kepala2024  → dashboard, /siswa, /halaqoh, /tasks, /dashboard/analitik')
  console.log('  • Guru: ust_ahmad / Guru@ahmad2026 → /guru, lihat 4 siswa Halaqoh Abu Bakr + riwayat setoran')
}

main().catch(err => { console.error('Seed gagal:', err); process.exit(1) })
