import { cache } from 'react'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { EmployeeSessionData } from '@/types'
import { createServerClient } from '@/lib/supabase/server'
import { isContractExpired } from './contract'

const COOKIE_NAME = 'rqlhi-employee-session'

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function createEmployeeSession(
  data: Omit<EmployeeSessionData, 'isLoggedIn' | 'type'>,
) {
  const token = await new SignJWT({ ...data, isLoggedIn: true, type: 'employee' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

/**
 * Sesi karyawan untuk halaman & action di /karyawan.
 *
 * Cookie-nya sendiri, dan `type` diperiksa: token guru dan token karyawan
 * ditandatangani rahasia yang sama, jadi tanpa pemeriksaan itu token guru yang
 * disalin ke cookie ini akan lolos sebagai karyawan.
 *
 * Sama seperti sesi guru, akunnya diperiksa ulang ke database tiap request —
 * token berumur 7 hari dan tidak membawa status apa pun, sehingga karyawan yang
 * baru dinonaktifkan atau dihapus tetap bisa memakai sesi lamanya sampai
 * seminggu ke depan kalau tidak diperiksa.
 */
export const getEmployeeSession = cache(async (): Promise<EmployeeSessionData | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  let data: EmployeeSessionData
  try {
    const { payload } = await jwtVerify(token, getSecret())
    data = payload as unknown as EmployeeSessionData
    if (data.type !== 'employee') return null
  } catch {
    return null
  }

  try {
    const supabase = createServerClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('id, contract_end')
      .eq('id', data.employeeId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (!employee) return null
    if (isContractExpired(employee.contract_end as string | null)) return null
  } catch {
    // Database tak terjangkau: tolak sesinya, minta login ulang. Lebih baik
    // daripada meloloskan akun yang mungkin sudah dicabut.
    return null
  }

  return data
})

export async function destroyEmployeeSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export const EMPLOYEE_COOKIE_NAME = COOKIE_NAME
