'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginTeacherAction } from '@/app/actions/teacher-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/brand/Logo'

export default function TeacherLoginPage() {
  const [state, action, isPending] = useActionState(loginTeacherAction, null)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo variant="full" size={132} priority />
        <p
          className="text-base font-semibold"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Portal Guru
        </p>
      </div>

      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">Masuk sebagai Guru</CardTitle>
          <CardDescription>
            Masukkan username &amp; password yang diberikan admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="contoh: ust_ahmad"
                autoComplete="username"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
              />
            </div>

            {state?.error && (
              <p className="text-sm font-medium text-destructive bg-destructive-wash px-4 py-3 rounded-xl">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? 'Memuat...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 text-center space-y-1">
        <p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            ← Kembali ke halaman utama
          </Link>
        </p>
        <p>
          <Link href="/login" className="text-xs text-muted-foreground hover:underline">
            Login sebagai admin/koor →
          </Link>
        </p>
      </div>
    </div>
  )
}
