import { BookMarked, BookOpen } from 'lucide-react'
import type { CapaianKelompok } from '@/lib/data/capaian-kelas'
import { Panel } from '@/components/dashboard/kit'
import { MatriksCapaianTable } from '@/components/dashboard/MatriksCapaianTable'

/**
 * Tahsin & tahfidz satu kelompok (unit × jalur). Tahfidz bisa lebih dari satu
 * tabel: blok Juz 30–26 selalu ada, blok Juz 1–5 dan seterusnya muncul begitu
 * ada anak yang sampai di sana.
 */
export function CapaianKelompokPanel({ k, tampil = 'semua' }: {
  k: CapaianKelompok
  tampil?: 'semua' | 'tahsin' | 'tahfidz'
}) {
  const kosong = k.jalur === 'quls'
    ? `Belum ada siswa ${k.judul.split(' — ')[0]} yang ditandai program QULS. Tandai programnya di data siswa agar muncul di sini.`
    : `Belum ada siswa aktif di ${k.judul}.`

  return (
    <div className="space-y-5">
      {tampil !== 'tahfidz' && (
        <Panel title="Capaian Tahsin" icon={<BookOpen className="h-4 w-4" />}
          sub="Jilid/tahap menurut setoran terakhir · % = siswa yang mencapai target jilid kelasnya">
          <MatriksCapaianTable matriks={k.tahsin} kosong={kosong} topik={`${k.judul} · Tahsin`} />
        </Panel>
      )}
      {tampil !== 'tahsin' && (
        <Panel title="Capaian Tahfidz" icon={<BookMarked className="h-4 w-4" />}
          sub="Juz menurut setoran terakhir & ujian · % = siswa yang sesuai atau di atas target tahfidznya">
          {k.siswa === 0 ? (
            <p className="text-sm text-muted-foreground">{kosong}</p>
          ) : (
            <div className="space-y-6">
              {k.tahfidz.map(m => (
                <div key={m.judul}>
                  {k.tahfidz.length > 1 && (
                    <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{m.judul}</h3>
                  )}
                  <MatriksCapaianTable matriks={m} kosong="Belum ada siswa di blok ini." topik={`${k.judul} · ${m.judul}`} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
