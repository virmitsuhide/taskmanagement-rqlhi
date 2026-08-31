'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { isContractExpired } from '@/lib/auth/contract'
import { createEmployeeSession, destroyEmployeeSession } from '@/lib/auth/employee-session'

export async function loginEmployeeAction(_: unknown, formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  const supabase = createServerClient()
  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, username, password_hash, full_name, is_active, contract_end')
    .eq('username', username)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !employee) {
    return { error: 'Username atau password salah.' }
  }
  if (!employee.is_active) {
    return { error: 'Akun karyawan ini sudah dinonaktifkan. Hubungi admin.' }
  }
  if (isContractExpired(employee.contract_end)) {
    return { error: 'Masa kontrak akun ini sudah berakhir. Hubungi admin RQ.' }
  }

  const valid = await bcrypt.compare(password, employee.password_hash)
  if (!valid) {
    return { error: 'Username atau password salah.' }
  }

  await createEmployeeSession({
    employeeId: employee.id,
    username: employee.username,
    fullName: employee.full_name,
  })

  redirect('/karyawan/profil')
}

export async function logoutEmployeeAction() {
  await destroyEmployeeSession()
  redirect('/karyawan/login')
}
