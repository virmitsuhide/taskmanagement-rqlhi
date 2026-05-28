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
