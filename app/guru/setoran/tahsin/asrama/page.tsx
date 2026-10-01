import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getKelompokAsrama } from '@/lib/data/asrama'
import { getSiswaSesiTahsin } from '@/lib/data/setoran-sesi'
import { TAHSIN_ASRAMA_DIBUKA } from '@/lib/rq/asrama'
import { LABEL_STATUS_TAHSIN } from '@/lib/rq/status-tahsin'
import { SetoranSesiTahsin } from '@/components/setoran/SetoranSesiTahsin'
import { LencanaLevel } from '@/components/asrama/LencanaLevel'
import { PilihKelompokAsrama } from '@/components/asrama/PilihKelompokAsrama'
import type { SuratPilihan } from '@/components/setoran/SetoranSesiTahfidz'
import type { TahsinStatus } from '@/types'

interface PageProps {
  searchParams: Promise<{ kelompok?: string }>
}

interface PosisiTahsin {
  id: string
  nama: string
  kelas: string | null
  jilid: string | null
  halaman: number | null
  total: number | null
  lulus: boolean
  terakhir: { tanggal: string; halaman: number | null; status: TahsinStatus } | null
}

function tanggalPendek(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Tahsin Asrama — Sesi Tahsin untuk kelompok asrama (0110).
 *
 * Untuk sementara HANYA LIHAT (TAHSIN_ASRAMA_DIBUKA = false): posisi tahsin
 * anak boarding ditetapkan dulu oleh capaian yang diinput pengampu sekolah.
 * Pengampu asrama melihat posisi itu di sini; begitu konstantanya dibuka,
 * halaman ini memakai formulir Sesi Tahsin yang sama dengan jalur asrama.
 */
export default async function TahsinAsramaPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { kelompok: diminta } = await searchParams
  const daftar = await getKelompokAsrama({ pengampuId: session.teacherId })
  const kelompok = daftar.find(k => k.id === diminta) ?? daftar[0] ?? null
  const ids = kelompok?.anggota.map(a => a.student_id) ?? []
  const level = new Map(kelompok?.anggota.map(a => [a.student_id, a.level]) ?? [])
  const supabase = createServerClient()

  const judul = (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Halaqoh Asrama</p>
      <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
        Tahsin Asrama{kelompok ? ` — ${kelompok.nama}` : ''}
      </h1>
    </div>
  )

  if (!kelompok) {
    return (
      <Bingkai>
        {judul}
        <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Anda belum ditetapkan sebagai pengampu kelompok asrama.
        </div>
      </Bingkai>
    )
  }

  if (TAHSIN_ASRAMA_DIBUKA) {
    const [siswa, suratRes] = await Promise.all([
      ids.length ? getSiswaSesiTahsin({ siswa: ids }) : Promise.resolve([]),
      supabase.from('surat_master').select('id, name_latin, total_ayat, juz_start').order('id'),
    ])
    return (
      <Bingkai>
        {judul}
        <PilihKelompokAsrama daftar={daftar} terpilih={kelompok.id} basePath="/guru/setoran/tahsin/asrama" />
        <SetoranSesiTahsin key={kelompok.id} siswa={siswa} surat={(suratRes.data ?? []) as SuratPilihan[]}
          halaqohId="" pengaturan={null} asrama />
      </Bingkai>
    )
  }

  // ── Hanya lihat: posisi dari capaian sekolah ──
  const [siswaRes, logRes] = await Promise.all([
    ids.length
      ? supabase.from('students')
          .select('id, full_name, kelas, current_jilid_page, jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, is_terminal)')
          .in('id', ids).eq('is_active', true).order('full_name')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('tahsin_logs').select('student_id, setoran_date, halaman, status')
          .in('student_id', ids).order('setoran_date', { ascending: false }).order('created_at', { ascending: false }).limit(ids.length * 10)
      : Promise.resolve({ data: [] }),
  ])
  const terakhir = new Map<string, PosisiTahsin['terakhir']>()
  for (const l of (logRes.data ?? []) as { student_id: string; setoran_date: string; halaman: number | null; status: TahsinStatus }[]) {
    if (!terakhir.has(l.student_id)) terakhir.set(l.student_id, { tanggal: l.setoran_date, halaman: l.halaman, status: l.status })
  }
  const siswa: PosisiTahsin[] = ((siswaRes.data ?? []) as unknown as {
    id: string; full_name: string; kelas: string | null; current_jilid_page: number | null
    jilid: { label: string; total_pages: number | null; is_terminal: boolean } | null
  }[]).map(s => ({
    id: s.id, nama: s.full_name, kelas: s.kelas,
    jilid: s.jilid?.label ?? null, halaman: s.current_jilid_page, total: s.jilid?.total_pages ?? null,
    lulus: Boolean(s.jilid?.is_terminal), terakhir: terakhir.get(s.id) ?? null,
  }))
  const menunggu = siswa.filter(s => !s.jilid).length

  return (
    <Bingkai>
      {judul}
      <PilihKelompokAsrama daftar={daftar} terpilih={kelompok.id} basePath="/guru/setoran/tahsin/asrama" />

      <div className="flex gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <b className="text-foreground">Setoran tahsin asrama belum dibuka.</b> Posisi tahsin anak mengikuti capaian
          yang diinput pengampu sekolah. Untuk sementara catat hafalan di <Link href="/guru/setoran/tahfidz/asrama" className="font-medium text-primary hover:underline">Tahfidz Asrama</Link>.
          {menunggu > 0 && <> {menunggu} anak masih menunggu capaian sekolah pertama.</>}
        </p>
      </div>

      {siswa.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
          Kelompok ini belum punya anggota.
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {siswa.map(s => (
            <li key={s.id}>
              <Link href={`/guru/siswa/${s.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{s.nama}</span>
                    <LencanaLevel level={level.get(s.id)} />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.lulus
                      ? 'Lulus Tahsin'
                      : s.jilid
                        ? `${s.jilid}${s.halaman ? ` · hal. ${s.halaman}${s.total ? `/${s.total}` : ''}` : ''}`
                        : <span className="text-warning">Menunggu capaian sekolah</span>}
                    {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {s.terakhir
                    ? <>Setoran terakhir<br />{tanggalPendek(s.terakhir.tanggal)}{s.terakhir.halaman ? ` · hal. ${s.terakhir.halaman}` : ''} · {LABEL_STATUS_TAHSIN[s.terakhir.status] ?? s.terakhir.status}</>
                    : 'Belum ada setoran'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Bingkai>
  )
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">{children}</div>
    </div>
  )
}
