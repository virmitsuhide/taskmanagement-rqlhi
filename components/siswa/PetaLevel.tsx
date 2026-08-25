import { berkelok, type NodeLevel } from '@/lib/rq/peta-belajar'
import { cn } from '@/lib/utils'

interface Props {
  nodes: NodeLevel[]
  /** Node per baris. Ganjil lebih enak dilihat — belokannya tidak simetris kaku. */
  perBaris?: number
  legend?: { warna: string; label: string }[]
}

/**
 * Peta belajar bergaya peta level permainan.
 *
 * Node disusun berkelok dan disambung garis, jadi urutan belajarnya terbaca
 * sebagai satu jalur yang ditempuh — bukan sekadar kisi angka. Yang sudah
 * dilewati terisi penuh, yang sedang dijalani bercincin kemajuan dan
 * berdenyut, sisanya pudar.
 *
 * Digambar dengan CSS biasa, tanpa pustaka grafik: isinya cuma lingkaran dan
 * garis, dan versi SVG-nya justru lebih sulit dibuat ikut mengalir saat lebar
 * layar berubah.
 */
export function PetaLevel({ nodes, perBaris = 5, legend }: Props) {
  const rows = berkelok(nodes, perBaris)

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="space-y-1">
        {rows.map((row, ri) => (
          <div key={ri} className="relative">
            {/*
              Garis jalur digambar di belakang node. Dipendekkan di kedua ujung
              (inset) supaya tidak menjulur keluar pada baris terakhir yang
              belum penuh.
            */}
            <div
              className="pointer-events-none absolute left-[10%] right-[10%] top-6 h-0.5 bg-border"
              aria-hidden
            />
            <ul
              className={cn(
                'relative flex list-none justify-around gap-1 px-1',
                // Baris terakhir yang tidak penuh dirapatkan ke sisi belokan,
                // supaya tidak melayang di tengah dan memutus alur jalurnya.
                row.length < perBaris && (ri % 2 === 1 ? 'justify-end' : 'justify-start'),
              )}
            >
              {row.map(n => (
                <li key={n.key} className="flex w-14 flex-col items-center gap-1 shrink-0">
                  <div
                    title={n.title}
                    className={cn(
                      'relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-transform',
                      n.status === 'selesai' && 'border-success bg-success text-white',
                      n.status === 'proses' && 'border-primary bg-primary-wash text-primary animate-pulse',
                      n.status === 'terkunci' && 'border-border bg-muted text-muted-foreground/70',
                    )}
                  >
                    {n.label}
                    {n.badge && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[10px] leading-4 shadow-sm">
                        {n.badge}
                      </span>
                    )}
                    {/* Cincin kemajuan hanya untuk node berjalan; pada node
                        selesai ia mubazir, dan pada yang terkunci menyesatkan. */}
                    {n.status === 'proses' && n.progressPct !== undefined && n.progressPct > 0 && (
                      <svg className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] -rotate-90" viewBox="0 0 40 40" aria-hidden>
                        <circle
                          cx="20" cy="20" r="18" fill="none"
                          stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"
                          strokeDasharray={`${(n.progressPct / 100) * 113} 113`}
                          opacity="0.85"
                        />
                      </svg>
                    )}
                  </div>
                  {n.caption && (
                    <span className="text-center text-[10px] leading-tight text-muted-foreground line-clamp-2">
                      {n.caption}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {legend && (
        <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-[11px] text-muted-foreground">
          {legend.map(l => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border" style={{ background: l.warna }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
