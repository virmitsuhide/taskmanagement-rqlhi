import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getRaporTemplates } from '@/lib/data/rapor-template'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UnggahTemplate } from '@/components/rapor/UnggahTemplate'
import { cariSlot } from '@/lib/rapor/medan'

/**
 * Template rapor Qur'an — milik koordinator unit.
 *
 * Bentuk rapor adalah keputusan unit, bukan keputusan seorang guru: satu
 * angkatan harus menerima lembar yang sama. Guru memakainya di
 * /guru/rapor-quran, dan yang ia tulis di sana hanyalah deskripsi anaknya.
 */
export default async function TemplateRaporPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const jenjang = getManageableJenjang(session.role).filter(j => canManageRaporTemplate(session.role, j))
  if (jenjang.length === 0) redirect('/dashboard')

  const { tabelAda, daftar } = await getRaporTemplates(jenjang)

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Template Rapor Qur'an" showBack ownH1 />

      <div className="max-w-5xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Template Rapor Qur&apos;an</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Unggah berkas Word yang sudah dipakai sekolah, tentukan kelas berapa yang memakainya, lalu petakan baris
            mana yang diisi data. Guru tinggal menulis deskripsi tiap anak.
          </p>
        </div>

        {!tabelAda ? (
          <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
            Tabel template belum ada di basis data. Jalankan{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0082_rapor_quran_template_PASTE_TO_SUPABASE.sql</code>{' '}
            di Supabase SQL Editor lebih dulu (0081 juga, untuk kehadiran).
          </div>
        ) : (
          <>
            <UnggahTemplate jenjang={jenjang} />

            {daftar.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Belum ada template.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {daftar.map(t => {
                  const slot = cariSlot(t.blok)
                  const dipetakan = slot.filter(s => {
                    const k = t.pemetaan[s.id]
                    return k && k !== 'tetap' && k !== 'kosongkan'
                  }).length
                  const adaDeskripsi = Object.values(t.pemetaan).includes('deskripsi')
                  return (
                    <li key={t.id}>
                      <Link href={`/rapor-quran/template/${t.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-semibold">{t.nama}</p>
                          {!t.aktif && <span className="text-xs text-muted-foreground">nonaktif</span>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {JENJANG_LABELS[t.jenjang]} · kelas {t.tingkat_min}
                          {t.tingkat_max !== t.tingkat_min && `–${t.tingkat_max}`} · {dipetakan} medan terpetakan
                        </p>
                        {!adaDeskripsi && (
                          <p className="mt-1 text-[11px] text-[color:var(--destructive)]">
                            Belum ada tempat untuk deskripsi guru — rapor akan tercetak tanpa narasi.
                          </p>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
