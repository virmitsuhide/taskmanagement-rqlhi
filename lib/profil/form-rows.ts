/**
 * Membaca daftar baris berulang dari FormData.
 *
 * Form profil mengirim tiap kolom sebagai medan bernama sama yang diulang —
 * `edu_level` empat kali untuk empat baris pendidikan. FormData.getAll()
 * memberi tiap kolom sebagai larik terpisah, dan fungsi ini menyusunnya balik
 * jadi baris.
 *
 * `requiredKey` menentukan baris mana yang dianggap benar-benar diisi: baris
 * yang kolom itunya kosong dibuang. Tanpa itu, satu baris kosong yang tertinggal
 * di form (dan selalu ada satu, karena form membuka dengan satu baris kosong)
 * akan tersimpan sebagai entri hampa di riwayat pendidikan setiap guru.
 *
 * Dipakai bersama oleh profil pengurus (app/actions/profile.ts) dan profil guru
 * (app/actions/teacher-profile.ts). Keduanya memakai bentuk data yang sama
 * persis, jadi menyalin fungsi ini ke dua tempat hanya menyiapkan keduanya
 * untuk menyimpang.
 */
export function collectRows<T>(
  formData: FormData,
  fields: { key: keyof T & string; field: string }[],
  requiredKey: keyof T & string,
): T[] {
  const columns = fields.map(f => formData.getAll(f.field).map(v => String(v)))
  const length = Math.max(0, ...columns.map(c => c.length))

  const rows: T[] = []
  for (let i = 0; i < length; i++) {
    const row: Record<string, string> = {}
    fields.forEach((f, ci) => {
      row[f.key] = (columns[ci][i] ?? '').trim()
    })
    if (row[requiredKey]) rows.push(row as T)
  }
  return rows
}
