import { SignJWT, jwtVerify } from 'jose'

/**
 * Token rapor untuk link publik wali murid (tanpa login).
 * Ditandatangani HMAC pakai SESSION_SECRET — tamper-proof & unguessable.
 * Tidak expire (rapor bulan tertentu boleh dibuka kapan saja oleh wali).
 */

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export interface RaporTokenPayload {
  sid: string   // student id
  y: number     // year
  m: number     // month (1-12)
}

export async function createRaporToken(payload: RaporTokenPayload): Promise<string> {
  return new SignJWT({ ...payload, kind: 'rapor' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyRaporToken(token: string): Promise<RaporTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.kind !== 'rapor') return null
    const { sid, y, m } = payload as unknown as RaporTokenPayload & { kind: string }
    if (!sid || !y || !m) return null
    return { sid, y, m }
  } catch {
    return null
  }
}

/**
 * Token laporan orang tua per SESI — tautan yang dibuka wali tanpa login.
 *
 * Bedanya dengan token rapor per anak: isinya seluruh anak satu halaqoh,
 * karena memang itulah yang dikirim ke grup wali sesi. Siapa pun yang
 * memegang tautannya bisa membacanya, jadi ia hanya untuk grup wali sesi
 * itu — bukan untuk disebar lebih luas.
 *
 * Tanggalnya dibekukan di dalam token, bukan disimpan sebagai preset
 * ("pekan ini"): tautan yang sama harus menampilkan laporan yang sama
 * bulan depan, bukan pekan mana pun yang sedang berjalan saat dibuka.
 *
 * `tid` = guru yang membagikan. Laporan ditandatangani atas namanya, jadi
 * penandatangannya ikut dibekukan bersama tanggalnya.
 */
export interface LaporanTokenPayload {
  hid: string   // halaqoh id
  tid: string   // teacher id — penanda tangan laporan
  d: string     // dari, YYYY-MM-DD
  s: string     // sampai, YYYY-MM-DD
}

export async function createLaporanToken(payload: LaporanTokenPayload): Promise<string> {
  return new SignJWT({ ...payload, kind: 'laporan' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}

export async function verifyLaporanToken(token: string): Promise<LaporanTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.kind !== 'laporan') return null
    const { hid, tid, d, s } = payload as unknown as LaporanTokenPayload & { kind: string }
    if (!hid || !tid || !d || !s) return null
    return { hid, tid, d, s }
  } catch {
    return null
  }
}
