import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TahsinSetoranForm } from './TahsinSetoranForm'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import { getMateriPerJilid, getHasilMateriPerSiswa } from '@/lib/data/materi-tahsin'
import { getHalaqohSesiGuru, halamanDrill, lanjutTerbuka, namaSesiPerHalaqoh } from '@/lib/data/setoran-sesi'
import { getHadirRiyadhoh, getPesertaKelompok, getSabtuPengampu } from '@/lib/data/riyadhoh'

interface PageProps {
  /** riyadhoh = tanggal Sabtu: setor satu-satu untuk peserta Riyadhoh kelompok pengampu ini. */
  searchParams: Promise<{ student?: string; antrian?: string; ok?: string; riyadhoh?: string }>
}

export default async function NewTahsinSetoranPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { student: defaultStudentId, antrian: antrianQs, ok: okQs, riyadhoh: riyadhohQs } = await searchParams
  const antrian = (antrianQs ?? '').split(',').filter(x => /^[0-9a-f-]{36}$/.test(x))
  const ok = okQs === '1'

  const supabase = createServerClient()
  // Hanya halaqoh tempat guru boleh mencatat tahsin (guru tahfidz SMA tidak).
  const [halaqohIds, daftarSesi] = await Promise.all([
    getTeacherHalaqohIds(session.teacherId, 'tahsin'),
    getHalaqohSesiGuru(session.teacherId),
  ])
  // Sesi gabungan guru tahsin (SMA) tampil dengan namanya sendiri, bukan nama
  // halaqoh guru tahfidz tempat anak itu tercatat.
  const namaSesi = namaSesiPerHalaqoh(daftarSesi)

  // Mode Riyadhoh: anak kelompok pengampu ini yang hadir/belum dicatat pada
  // Sabtu itu — bukan anak halaqohnya. Tanggal dikunci ke Sabtu tersebut;
  // server tetap memeriksa lewat aksesSetoran saat menyimpan.
  let riyadhoh: { tanggal: string; ids: string[] } | null = null
  if (riyadhohQs && /^\d{4}-\d{2}-\d{2}$/.test(riyadhohQs)) {
    const sabtu = await getSabtuPengampu(session.teacherId, riyadhohQs)
    if (sabtu.terpilih?.tanggal === riyadhohQs && riyadhohQs <= sabtu.hariIni) {
      const [peserta, hadir] = await Promise.all([
        getPesertaKelompok(sabtu.terpilih.kelompok, session.teacherId),
        getHadirRiyadhoh(riyadhohQs),
      ])
      riyadhoh = { tanggal: riyadhohQs, ids: peserta.filter(p => !hadir[p.id] || hadir[p.id] === 'hadir').map(p => p.id) }
    }
  }

  const [studentsRes, methodsRes, jilidRes, suratRes] = await Promise.all([
    (riyadhoh ? riyadhoh.ids.length > 0 : halaqohIds.length > 0)
      ? supabase
          .from('students')
          .select('id, full_name, jenjang, halaqoh_id, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak,'
            + ' current_quran_halaman, current_quran_surat_id, current_quran_ayat,'
            + ' halaqoh:halaqoh!students_halaqoh_id_fkey(name),'
            + ' jilid:jilid_levels!students_current_jilid_id_fkey(is_terminal)')
          .in(riyadhoh ? 'id' : 'halaqoh_id', riyadhoh ? riyadhoh.ids : halaqohIds)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num, total_pages, baca_quran').order('order_num'),
    supabase.from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
  ])

  const students = ((studentsRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; jenjang: string; halaqoh_id: string | null; current_method_id: string | null
    current_jilid_id: string | null; current_jilid_page: number | null
    tahsin_drill_sejak: string | null
    current_quran_halaman: number | null; current_quran_surat_id: number | null; current_quran_ayat: number | null
    halaqoh: { name: string } | null
    jilid: { is_terminal: boolean } | null
  }>)
    // Anak yang sudah Lulus Tahsin tidak bisa dipilih — progres tahsinnya sudah selesai.
    .filter(s => !s.jilid?.is_terminal)
    .map(s => ({
    id: s.id,
    full_name: s.full_name,
    jenjang: s.jenjang,
    halaqoh_name: (s.halaqoh_id ? namaSesi.get(s.halaqoh_id) : null) ?? s.halaqoh?.name ?? null,
    current_method_id: s.current_method_id,
    current_jilid_id: s.current_jilid_id,
    current_jilid_page: s.current_jilid_page,
    tahsin_drill_sejak: s.tahsin_drill_sejak,
    quran: {
      halaman: s.current_quran_halaman,
      surat_id: s.current_quran_surat_id,
      ayat: s.current_quran_ayat,
    },
  }))

  /*
    Materi Gharib/Tajwid dimuat untuk SEMUA anak sekaligus, bukan menunggu
    guru memilih satu. Pemilihan siswa terjadi di peramban tanpa perjalanan
    balik ke server, jadi memuat belakangan berarti daftar materinya baru
    muncul beberapa saat setelah namanya dipilih — tepat ketika guru sudah
    mulai mengetik.
  */
  const halamanJilid = new Map(((jilidRes.data ?? []) as { id: string; total_pages: number | null }[]).map(j => [j.id, j.total_pages]))
  const [materiPerJilid, hasilPerSiswa, lanjut, drill] = await Promise.all([
    getMateriPerJilid(students.map(s => s.current_jilid_id ?? '')),
    getHasilMateriPerSiswa(students.map(s => s.id)),
    lanjutTerbuka(supabase, students),
    halamanDrill(supabase, students.map(s => ({ ...s, total_pages: halamanJilid.get(s.current_jilid_id ?? '') ?? null }))),
  ])

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {ok && (
          <p className="mb-4 rounded-xl border border-success/40 bg-success-wash px-4 py-2.5 text-sm text-success">
            Setoran sebelumnya tersimpan. Lanjut ke anak berikutnya.
          </p>
        )}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">{riyadhoh ? 'Riyadhoh Sabtu' : 'Setoran Harian'}</p>
            <h1
              className="text-3xl tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Setor Tahsin
            </h1>
          </div>
          {riyadhoh ? (
            <Link href={`/guru/riyadhoh/tahsin?tanggal=${riyadhoh.tanggal}`} className="text-sm font-medium text-primary hover:underline">
              ← Kembali ke Setor Tahsin Riyadhoh
            </Link>
          ) : (
            <Link href="/guru/setoran/tahsin/sesi" className="text-sm font-medium text-primary hover:underline">
              Setor satu sesi sekaligus →
            </Link>
          )}
        </div>

        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            {riyadhoh ? 'Tidak ada anak kelompok Riyadhoh Anda yang hadir di Sabtu ini.' : 'Belum ada siswa di halaqoh Anda. Hubungi admin untuk assign siswa.'}
          </div>
        ) : (
          <TahsinSetoranForm
            students={students.map(s => {
              // Anak drill: halaman bawaan formulir = jalan drillnya (mulai hal. 1),
              // bukan halaman terakhir jilid. Posisi resminya dibaca ulang di server.
              const d = drill.get(s.id)
              return d
                ? { ...s, current_jilid_page: d.halaman, lanjut: d.lanjut, drill_putaran: d.putaran }
                : { ...s, lanjut: lanjut.get(s.id) ?? null, drill_putaran: null }
            })}
            methods={methodsRes.data ?? []}
            jilidLevels={jilidRes.data ?? []}
            surat={(suratRes.data ?? []) as SuratPilihan[]}
            materiPerJilid={Object.fromEntries(materiPerJilid)}
            materiHasil={Object.fromEntries(
              [...hasilPerSiswa].map(([id, per]) => [id, Object.fromEntries(per)]),
            )}
            defaultStudentId={defaultStudentId}
            antrian={antrian}
            tanggalTetap={riyadhoh?.tanggal}
            kembali={riyadhoh ? `/guru/riyadhoh/tahsin?tanggal=${riyadhoh.tanggal}` : undefined}
          />
        )}
      </div>
    </div>
  )
}
