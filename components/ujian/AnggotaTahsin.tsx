import { cn } from '@/lib/utils'
import { groupSiswaByLevel } from '@/lib/rq/ujian'
import type { UjianTahsin } from '@/types'

/**
 * Nama anak dalam satu pengajuan ujian tahsin, dikelompokkan per level.
 *
 * Pengajuan tahsin disimpan per kelompok (judulnya nama ustadz/ah), jadi
 * tanpa daftar ini kartunya hanya berbunyi "Ustadzah X · 6 siswa" — guru tidak
 * bisa memastikan anak mana yang sudah ia ajukan, dan koordinator tidak bisa
 * melihat siapa yang menunggu tanpa membuka dialog kelola.
 *
 * Predikat diberi warna begitu ujiannya dinilai; sebelum itu nama tampil
 * polos, sebab "Belum" di setiap nama hanya menambah bising.
 */
export function AnggotaTahsin({ item, className }: { item: UjianTahsin; className?: string }) {
  const grup = groupSiswaByLevel(item)
  if (grup.length === 0) return null
  const dinilai = item.status === 'selesai'

  return (
    <div className={cn('space-y-1 text-xs', className)}>
      {grup.map(g => (
        <p key={g.level} className="leading-relaxed">
          <span className="font-medium text-muted-foreground">{g.level}:</span>{' '}
          {g.siswa.map((s, i) => (
            <span key={`${s.student_id ?? s.nama}-${i}`}>
              <span className={cn(
                dinilai && s.predikat === 'lulus' && 'text-success',
                dinilai && s.predikat === 'mengulang' && 'text-destructive',
              )}>
                {s.nama}
              </span>
              {i < g.siswa.length - 1 && <span className="text-muted-foreground">, </span>}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}
