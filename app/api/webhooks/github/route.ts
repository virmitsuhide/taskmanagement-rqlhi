import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { drafDariCommit } from '@/lib/rq/changelog-commit'

/**
 * Webhook push GitHub → draf Pembaruan Sistem (0128).
 *
 * Pasang di GitHub: Settings → Webhooks → Add webhook
 *   Payload URL  : https://<domain>/api/webhooks/github
 *   Content type : application/json
 *   Secret       : sama dengan env GITHUB_WEBHOOK_SECRET
 *   Events       : Just the push event
 *
 * Hanya push ke master yang diproses. Tiap commit menjadi paling banyak satu
 * draf (commit_sha unik), jadi kiriman ulang dari GitHub aman. Draf tidak
 * terlihat pembaca sampai Kepala RQ menerbitkannya di /pembaruan.
 *
 * Kunci Supabase tidak pernah meninggalkan server: GitHub hanya memegang
 * rahasia webhook, yang gunanya sebatas membuktikan kiriman ini dari GitHub.
 */

const CABANG = 'refs/heads/master'

interface CommitPush {
  id: string
  message: string
  timestamp: string
  distinct?: boolean
}

function tandaSah(isi: string, tanda: string | null, rahasia: string): boolean {
  if (!tanda?.startsWith('sha256=')) return false
  const harap = Buffer.from(`sha256=${createHmac('sha256', rahasia).update(isi).digest('hex')}`)
  const dapat = Buffer.from(tanda)
  return harap.length === dapat.length && timingSafeEqual(harap, dapat)
}

export async function POST(request: Request) {
  const rahasia = process.env.GITHUB_WEBHOOK_SECRET
  if (!rahasia) return Response.json({ error: 'GITHUB_WEBHOOK_SECRET belum diatur' }, { status: 503 })

  const isi = await request.text()
  if (!tandaSah(isi, request.headers.get('x-hub-signature-256'), rahasia)) {
    return Response.json({ error: 'tanda tangan tidak sah' }, { status: 401 })
  }

  const peristiwa = request.headers.get('x-github-event')
  if (peristiwa === 'ping') return Response.json({ ok: true, pesan: 'pong' })
  if (peristiwa !== 'push') return Response.json({ ok: true, dilewati: peristiwa })

  let muatan: { ref?: string; commits?: CommitPush[] }
  try { muatan = JSON.parse(isi) } catch { return Response.json({ error: 'muatan bukan JSON' }, { status: 400 }) }
  if (muatan.ref !== CABANG) return Response.json({ ok: true, dilewati: muatan.ref })

  const baris = (muatan.commits ?? [])
    // distinct=false: commit sudah pernah dikirim lewat push ke cabang lain.
    .filter(c => c.distinct !== false)
    .flatMap(c => {
      const d = drafDariCommit(c.message)
      if (!d) return []
      return [{
        judul: d.judul,
        isi: d.isi,
        jenis: d.jenis,
        untuk_pengurus: d.untuk.includes('pengurus'),
        untuk_guru: d.untuk.includes('guru'),
        untuk_karyawan: d.untuk.includes('karyawan'),
        terbit_at: c.timestamp,
        status: 'draf',
        commit_sha: c.id,
        commit_pesan: c.message.slice(0, 10000),
      }]
    })
  if (baris.length === 0) return Response.json({ ok: true, draf: 0 })

  const { error } = await createServerClient().from('changelog')
    .upsert(baris, { onConflict: 'commit_sha', ignoreDuplicates: true })
  if (error) {
    console.error('[webhook github] gagal menyimpan draf pembaruan:', error.message)
    return Response.json({ error: 'gagal menyimpan draf' }, { status: 500 })
  }

  revalidatePath('/pembaruan')
  return Response.json({ ok: true, draf: baris.length })
}
