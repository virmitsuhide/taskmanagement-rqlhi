import { createServerClient } from '@/lib/supabase/server'
import { TTD_BUCKET, TTD_MIME, MAX_TTD_BYTES } from '@/lib/kpi/tanda-tangan'

/**
 * Penyimpanan berkas tanda tangan.
 *
 * ── KENAPA BUCKET SENDIRI, DAN KENAPA TERTUTUP
 *
 * Foto profil di proyek ini disimpan di bucket publik dan diambil dengan
 * getPublicUrl() — pantas, sebab foto guru memang tampil di halaman publik.
 * Tanda tangan tidak begitu. Gambar tanda tangan Koordinator atau Kepala RQ
 * yang bisa diunduh siapa saja lewat url yang bocor atau tertebak adalah
 * bahan untuk memalsukan dokumen mana pun, bukan cuma rapor KPI.
 *
 * Karena itu bucket `signatures` dibuat TIDAK publik, dan gambarnya diambil
 * lewat url bertanda tangan berumur pendek yang dibuat di server tiap kali
 * halaman dirender. Yang tersimpan di database adalah path objeknya, bukan
 * url — url yang disimpan akan kedaluwarsa dan meninggalkan gambar rusak di
 * rapor lama.
 *
 * ⚠️ Buat bucket-nya sekali di Supabase (Storage → New bucket):
 *      nama   : signatures
 *      publik : TIDAK
 */

/** Umur url bertanda tangan. Cukup untuk merender & mencetak satu halaman. */
const UMUR_URL_DETIK = 60 * 30

/**
 * Ubah path objek menjadi url siap pakai untuk <img>.
 *
 * Mengembalikan null — bukan melempar — saat path kosong, bucket belum dibuat,
 * atau berkasnya sudah tidak ada. Lembar rapor menangani ketiadaan tanda
 * tangan dengan baik (kotaknya dibiarkan kosong untuk ditandatangani basah);
 * yang tidak bisa ia tangani adalah galat yang menjatuhkan seluruh halaman
 * hanya karena satu gambar hilang.
 */
export async function ttdSrc(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.storage
      .from(TTD_BUCKET)
      .createSignedUrl(path, UMUR_URL_DETIK)
    if (error || !data) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/**
 * Unggah gambar tanda tangan. Mengembalikan path objeknya, atau pesan galat
 * yang layak ditunjukkan kepada penggunanya.
 *
 * `upsert: false` dengan nama yang mengandung cap waktu: berkas lama tidak
 * ditimpa, sebab rapor-rapor yang sudah terbit menunjuk kepadanya. Menimpanya
 * akan mengubah tanda tangan pada dokumen yang sudah ditandatangani — persis
 * hal yang dicegah dengan menyalin path ke baris rapor.
 */
export async function unggahTtd(
  file: File,
  pemilik: string,
): Promise<{ path: string } | { error: string }> {
  if (file.size === 0) return { error: 'Berkas tanda tangan kosong.' }
  if (file.size > MAX_TTD_BYTES) {
    return { error: `Gambar tanda tangan maksimal ${Math.round(MAX_TTD_BYTES / 1024)} KB.` }
  }
  if (!TTD_MIME.includes(file.type)) {
    return { error: 'Format harus PNG, WebP, atau JPEG. PNG berlatar transparan paling baik.' }
  }

  try {
    const bytes = await file.arrayBuffer()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${pemilik}/${Date.now()}.${ext}`

    const supabase = createServerClient()
    const { data, error } = await supabase.storage
      .from(TTD_BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false })

    if (error || !data) {
      // Bucket yang belum dibuat adalah kesalahan penyiapan, bukan kesalahan
      // orang yang sedang mengunggah — sebutkan langkahnya, jangan sekadar
      // "gagal mengunggah".
      const pesan = error?.message ?? ''
      if (pesan.toLowerCase().includes('bucket')) {
        return { error: `Bucket "${TTD_BUCKET}" belum ada di Supabase Storage. Buat dulu (jangan dicentang publik).` }
      }
      return { error: 'Gagal mengunggah tanda tangan.' }
    }

    return { path: data.path }
  } catch {
    return { error: 'Gagal mengunggah tanda tangan.' }
  }
}
