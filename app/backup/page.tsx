import { redirect } from 'next/navigation'
import { DatabaseBackup, Download, ShieldCheck } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DOMAIN_BACKUP, domainBackupUntuk } from '@/lib/backup/domain'

/**
 * Backup basis data per bidang. Tiap bidang satu berkas .json.gz yang
 * dialirkan langsung dari /backup/[domain] — tidak ada yang disimpan di
 * server, jadi berkasnya hanya ada di perangkat yang mengunduh.
 */
export default async function BackupPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const domain = domainBackupUntuk(session.role)
  if (domain.length === 0) redirect('/dashboard')

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Backup Data"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-4xl space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Keamanan data</p>
          <h1 className="mt-1 text-3xl leading-tight">Backup basis data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unduh salinan data bidang Anda sebagai berkas <b className="text-foreground">.json.gz</b> (JSON
            terkompres). Simpan di tempat aman — misalnya Google Drive lembaga — dan unduh ulang secara berkala.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {domain.map(d => {
            const info = DOMAIN_BACKUP[d]
            return (
              <li key={d} className="flex flex-col rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <DatabaseBackup className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-medium leading-tight">{info.judul}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{info.keterangan}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {info.tabel ? `${info.tabel.length} tabel` : 'Seluruh tabel'}
                    </p>
                  </div>
                </div>
                {/* Tautan biasa, bukan tombol aksi: unduhannya dialirkan
                    peramban sendiri, jadi berkas besar tidak menahan halaman. */}
                <a
                  href={`/backup/${d}`}
                  download
                  className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" /> Unduh backup
                </a>
              </li>
            )
          })}
        </ul>

        <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>
            Kata sandi akun tidak pernah ikut ke berkas backup. Berkas ini tetap memuat data pribadi siswa,
            wali, dan guru — jangan dibagikan di grup atau disimpan di perangkat pribadi yang dipakai bersama.
            Di akhir berkas ada <code>ringkasan</code> berisi jumlah baris tiap tabel untuk memeriksa keutuhannya.
          </p>
        </div>
      </div>
    </div>
  )
}
