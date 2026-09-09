import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { PemetaanUjian, type BarisPemetaan } from '@/components/ujian/PemetaanUjian'

/**
 * Memasangkan catatan ujian lama ke data siswa.
 *
 * Ada sebelum tautan student_id lahir: 36 dari 38 catatan menyimpan nama yang
 * sudah tersingkat, sehingga tidak bisa dicocokkan otomatis ke baris siswa.
 * Halaman ini yang menutup jarak itu, dan setelah semuanya terpasang ia akan
 * tinggal menampilkan daftar kosong — memang dirancang untuk habis masa
 * pakainya.
 */
export default async function PemetaanUjianPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)
  const supabase = createServerClient()

  // Unit disaring supaya koor SD tidak memasangkan anak SMP dan sebaliknya —
  // syarat yang sama dengan seluruh modul ujian.
  const { data } = await supabase
    .from('ujian_tahfidz')
    .select('id, unit, tipe, juz, nama_siswa, kelas, jadwal, student_id, siswa:students(full_name)')
    .in('unit', units)
    .order('created_at', { ascending: false })

  const baris: BarisPemetaan[] = (data ?? []).map(r => {
    const siswa = r.siswa as unknown as { full_name: string } | null
    return {
      id: r.id as string,
      unit: r.unit as BarisPemetaan['unit'],
      tipe: r.tipe as BarisPemetaan['tipe'],
      juz: String(r.juz),
      nama_siswa: r.nama_siswa as string,
      kelas: (r.kelas as string) ?? '',
      jadwal: (r.jadwal as string) ?? null,
      student_id: (r.student_id as string) ?? null,
      nama_terpetakan: siswa?.full_name ?? null,
    }
  })

  const belum = baris.filter(b => !b.student_id).length

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Pemetaan Ujian"
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Pemetaan' }]}
      />
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
        <UjianSubNav />

        <div>
          <p className="text-2xl leading-tight font-bold">Pemetaan Catatan Lama</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {belum === 0
              ? 'Semua catatan ujian sudah terhubung ke data siswa.'
              : `${belum} catatan belum terhubung ke data siswa.`}
          </p>
        </div>

        <div className="rounded-xl border bg-info-wash p-4 text-sm text-info">
          Catatan ujian yang dibuat sebelum pembaruan ini menyimpan nama yang sudah
          disingkat untuk flyer, sehingga tidak bisa dicocokkan otomatis ke siswa.
          Pasangkan satu per satu di bawah; setelah terpasang, ujiannya muncul di
          profil siswa dan ikut terhitung sebagai capaian juz.
        </div>

        <PemetaanUjian baris={baris} />
      </div>
    </div>
  )
}
