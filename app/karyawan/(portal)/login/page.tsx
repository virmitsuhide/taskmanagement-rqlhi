'use client'

import { useActionState } from 'react'
import { loginEmployeeAction } from '@/app/actions/employee-auth'
import {
  LoginShell, LoginFields, LoginError, LoginSubmit, LoginHelp, LoginLinks,
} from '@/components/auth/LoginShell'

export default function EmployeeLoginPage() {
  const [state, action, isPending] = useActionState(loginEmployeeAction, null)

  return (
    <LoginShell
      eyebrow="Masuk sebagai karyawan"
      title={<>Assalamu&rsquo;alaikum.</>}
      subtitle="Masukkan username & password yang diberikan admin."
      footer={
        <LoginLinks
          label="Bukan karyawan? Masuk sebagai"
          links={[
            { href: '/guru/login', label: 'Guru' },
            { href: '/login', label: 'Pengurus' },
          ]}
        />
      }
    >
      <form action={action} className="space-y-4">
        <LoginFields disabled={isPending} usernamePlaceholder="contoh: dewi_maghfiroh" />
        <LoginError message={state?.error} />
        <LoginSubmit pending={isPending} />
        <LoginHelp />
      </form>
    </LoginShell>
  )
}
