import { getSession } from '@/lib/auth/session'
import { bolehBackup, DOMAIN_BACKUP, KOLOM_RAHASIA } from '@/lib/backup/domain'
import { tanggalWIB } from '@/lib/rq/ujian'

/**
 * Unduh backup satu bidang sebagai JSON terkompres gzip (.json.gz).
 *
 * Isinya: { meta: {...}, tables: { <tabel>: [baris…] } }. Dialirkan tabel demi
 * tabel, halaman demi halaman — tidak pernah seluruh basis data di memori
 * sekaligus, dan berkasnya tidak terbentur batas ukuran jawaban.
 *
 * Kolom & kunci utama tiap tabel dibaca dari skema OpenAPI PostgREST:
 * kunci utama memberi urutan yang stabil untuk paging (tanpa urutan, baris
 * bisa terlewat atau terulang antar halaman), dan daftar kolom membuat kolom
 * rahasia bisa dibuang sebelum keluar dari server.
 */

export const maxDuration = 300

const UKURAN_HALAMAN = 1000

interface DefinisiTabel {
  properties?: Record<string, { description?: string }>
}

async function skema(url: string, kunci: string): Promise<Record<string, DefinisiTabel>> {
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, Accept: 'application/openapi+json' },
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`Skema tidak terbaca (${r.status})`)
  return ((await r.json()) as { definitions?: Record<string, DefinisiTabel> }).definitions ?? {}
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const session = await getSession()
  const { domain } = await params
  if (!session || !bolehBackup(session.role, domain)) {
    return new Response('Tidak memiliki izin untuk backup ini.', { status: 403 })
  }

  const url = process.env.SUPABASE_URL!
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY!
  let definisi: Record<string, DefinisiTabel>
  try {
    definisi = await skema(url, kunci)
  } catch (e) {
    return new Response(`Gagal membaca skema basis data: ${(e as Error).message}`, { status: 502 })
  }

  const info = DOMAIN_BACKUP[domain]
  const daftar = (info.tabel ?? Object.keys(definisi).sort()).filter(t => definisi[t])
  const headers = { apikey: kunci, Authorization: `Bearer ${kunci}`, Accept: 'application/json' }
  const enc = new TextEncoder()
  const dibuat = new Date().toISOString()

  const sumber = new ReadableStream<Uint8Array>({
    async start(ctl) {
      const tulis = (s: string) => ctl.enqueue(enc.encode(s))
      const jumlah: Record<string, number> = {}
      const galat: Record<string, string> = {}
      try {
        tulis(`{"meta":${JSON.stringify({
          aplikasi: "RQ LHI Management System",
          bidang: domain,
          judul: info.judul,
          dibuat,
          oleh: session.displayName,
          tabel: daftar,
          catatan: 'Kolom kata sandi (password_hash) sengaja tidak disertakan.',
        })},"tables":{`)

        for (const [i, t] of daftar.entries()) {
          const props = definisi[t].properties ?? {}
          const kolom = Object.keys(props).filter(c => !KOLOM_RAHASIA.test(c))
          const pk = Object.entries(props).filter(([, p]) => p.description?.includes('<pk/>')).map(([c]) => c)
          const urut = (pk.length ? pk : kolom.slice(0, 1)).map(c => `${c}.asc`).join(',')
          const select = kolom.map(c => `"${c}"`).join(',')

          tulis(`${i ? ',' : ''}${JSON.stringify(t)}:[`)
          let n = 0
          for (let dari = 0; ; dari += UKURAN_HALAMAN) {
            const r = await fetch(
              `${url}/rest/v1/${t}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(urut)}`,
              { headers: { ...headers, Range: `${dari}-${dari + UKURAN_HALAMAN - 1}`, 'Range-Unit': 'items' }, cache: 'no-store' },
            )
            if (!r.ok) { galat[t] = `${r.status} ${(await r.text()).slice(0, 200)}`; break }
            const baris = (await r.json()) as unknown[]
            for (const b of baris) tulis(`${n++ ? ',' : ''}${JSON.stringify(b)}`)
            if (baris.length < UKURAN_HALAMAN) break
          }
          tulis(']')
          jumlah[t] = n
        }
        // Ringkasan di akhir: jumlah baris per tabel untuk memeriksa keutuhan
        // berkas, dan tabel yang gagal dibaca — backup yang diam-diam bolong
        // lebih berbahaya daripada yang gagal terang-terangan.
        tulis(`},"ringkasan":${JSON.stringify({ jumlah_baris: jumlah, galat })}}`)
        ctl.close()
      } catch (e) {
        ctl.error(e)
      }
    },
  })

  const nama = `backup_rqlhi_${domain}_${tanggalWIB(new Date())}.json.gz`
  return new Response(sumber.pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${nama}"`,
      'Cache-Control': 'no-store',
    },
  })
}
