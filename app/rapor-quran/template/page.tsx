import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, FileText, LayoutTemplate } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getRaporTemplates } from '@/lib/data/rapor-template'
import { LABEL_JENIS_RAPOR } from '@/lib/rapor/jenis'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PageTitle } from '@/components/layout/PageTitle'
import { UnggahTemplate } from '@/components/rapor/UnggahTemplate'
import { cariSlot, slotIsianGuru } from '@/lib/rapor/medan'
import { cn } from '@/lib/utils'

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

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 md:p-6">
        <PageTitle icon={<LayoutTemplate className="size-5" aria-hidden />} title="Template Rapor Qur'an">
          Unggah berkas Word yang sudah dipakai sekolah, tentukan kelas berapa yang memakainya, lalu petakan baris
          mana yang diisi data. Guru tinggal menulis deskripsi tiap anak.
        </PageTitle>

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
              <div className="rounded-xl border border-dashed bg-card py-12 text-center">
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
                  const adaDeskripsi = Object.values(t.pemetaan).includes('deskripsi') || slotIsianGuru(t.blok, t.pemetaan).length > 0
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/rapor-quran/template/${t.id}`}
                        className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary dark:group-hover:bg-primary/20">
                          <FileText className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-semibold leading-snug">{t.nama}</p>
                            <span className={cn(
                              'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                              t.jenis === 'ats' ? 'bg-info-wash text-info' : 'bg-primary-wash text-primary',
                            )}>
                              {LABEL_JENIS_RAPOR[t.jenis]}
                            </span>
                            {!t.aktif && (
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Nonaktif</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {JENJANG_LABELS[t.jenjang]} · kelas {t.tingkat_min}
                            {t.tingkat_max !== t.tingkat_min && `–${t.tingkat_max}`} · {dipetakan} medan terpetakan
                          </p>
                          {!adaDeskripsi && (
                            <p className="mt-1.5 flex items-start gap-1 text-xs text-destructive">
                              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                              Belum ada tempat untuk deskripsi guru — rapor akan tercetak tanpa narasi.
                            </p>
                          )}
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
