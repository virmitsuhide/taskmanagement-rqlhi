import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canKelolaPanduanGuru, sasaranUnggahPanduan } from '@/lib/auth/permissions'
import { getPanduanSemua } from '@/lib/data/panduan-guru'
import { LABEL_SASARAN_PANDUAN, URUTAN_KATEGORI_PANDUAN, type KategoriPanduan } from '@/lib/rq/panduan-guru'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DashTop } from '@/components/dashboard/kit'
import { DaftarPanduan } from '@/components/panduan/DaftarPanduan'
import { FormUnggahPanduan, TombolHapusPanduan } from '@/components/panduan/FormUnggahPanduan'

interface PageProps {
  searchParams: Promise<{ kategori?: string }>
}

/**
 * Kelola Panduan Guru (0104). Pimpinan & divisi penopang mengunggah untuk
 * seluruh guru; koordinator unit untuk guru unitnya saja.
 */
export default async function KelolaPanduanGuruPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canKelolaPanduanGuru(session.role)) redirect('/dashboard')
  const sasaran = sasaranUnggahPanduan(session.role)!

  const sp = await searchParams
  const kategori = URUTAN_KATEGORI_PANDUAN.includes(sp.kategori as KategoriPanduan) ? (sp.kategori as KategoriPanduan) : null
  const daftar = await getPanduanSemua()
  const bolehHapus = (p: { diunggah_oleh: string | null; sasaran: string }) =>
    session.role === 'kepala_rq' || p.diunggah_oleh === session.userId || p.sasaran === sasaran

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Panduan Guru" ownH1 />
      <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
        <DashTop
          eyebrow="Portal guru · Panduan"
          title="Panduan Guru"
          context={<>SOP dan dokumen PDF yang dibaca guru di portalnya — tanpa perlu mengunduh, tetap bisa diunduh.</>}
          filters={null}
        />

        {daftar === null ? (
          <p className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm">
            Tabel panduan belum ada. Jalankan <code className="text-xs">drizzle/0104_panduan_guru_PASTE_TO_SUPABASE.sql</code> di Supabase.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Unggah dokumen</h2>
              <FormUnggahPanduan labelSasaran={LABEL_SASARAN_PANDUAN[sasaran]} />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Semua dokumen</h2>
              <DaftarPanduan
                daftar={daftar}
                kategori={kategori}
                tampilSasaran
                hrefKategori={k => (k ? `/panduan-guru?kategori=${k}` : '/panduan-guru')}
                hrefDokumen={id => `/panduan-guru/${id}`}
                aksi={p => (bolehHapus(p) ? <TombolHapusPanduan id={p.id} judul={p.judul} /> : null)}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
