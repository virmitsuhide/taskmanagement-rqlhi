'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'
import {
  LoginShell, LoginFields, LoginError, LoginSubmit, LoginHelp, LoginLinks,
} from '@/components/auth/LoginShell'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null)

  return (
    <LoginShell
      eyebrow="Masuk · pengurus & guru"
      title={<>Assalamu&rsquo;alaikum, <em>Ustadz/ah.</em></>}
      subtitle="Masukkan username dan password Anda."
      footer={
        <LoginLinks
          label="Masuk lewat portal lain"
          links={[
            { href: '/guru/login', label: 'Portal guru' },
            { href: '/karyawan/login', label: 'Karyawan? Masuk di sini' },
          ]}
        />
      }
    >
      <form action={action} className="space-y-4">
        <LoginFields disabled={isPending} usernamePlaceholder="contoh: kumikrqlhi" />
        <LoginError message={state?.error} />
        <LoginSubmit pending={isPending} />
        <LoginHelp />
      </form>
    </LoginShell>
  )
}
