/**
 * Perkecil foto profil di peramban SEBELUM dikirim ke server.
 *
 * Foto kamera HP lazimnya 2–5 MB, padahal server action Next.js menolak
 * badan permintaan di atas batasnya — dan penolakan itu terjadi sebelum kode
 * unggah kita sempat berjalan, sehingga foto tidak pernah sampai ke storage.
 * Foto profil hanya tampil sebagai lingkaran kecil; 800 px sudah jauh lebih
 * dari cukup, dan hasilnya biasanya 100–300 KB.
 *
 * Bila apa pun gagal (peramban lama, format tak terbaca), file asli dikembalikan
 * apa adanya — server tetap menjaga batas ukurannya sendiri.
 */
const SISI_MAKS = 800
const KUALITAS = 0.85

export async function kompresFotoProfil(file: File, sisiMaks = SISI_MAKS): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height))
    const lebar = Math.round(bitmap.width * skala)
    const tinggi = Math.round(bitmap.height * skala)

    const canvas = document.createElement('canvas')
    canvas.width = lebar
    canvas.height = tinggi
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // Latar putih: PNG transparan yang dijadikan JPEG tidak berubah hitam.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, lebar, tinggi)
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi)
    bitmap.close()

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', KUALITAS))
    if (!blob || blob.size >= file.size) return file
    const nama = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nama, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

/**
 * Ganti isi <input type="file"> dengan versi yang sudah dikompres, supaya
 * form yang dikirim apa adanya (action={…}) ikut membawa file kecilnya.
 */
export async function gantiDenganFotoKompres(input: HTMLInputElement, sisiMaks = SISI_MAKS): Promise<File | null> {
  const asli = input.files?.[0]
  if (!asli) return null
  const kecil = await kompresFotoProfil(asli, sisiMaks)
  if (kecil !== asli && typeof DataTransfer !== 'undefined') {
    const dt = new DataTransfer()
    dt.items.add(kecil)
    input.files = dt.files
  }
  return kecil
}
