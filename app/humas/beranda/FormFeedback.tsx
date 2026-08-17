import { CheckCircle2 } from 'lucide-react'

/** Pesan hasil submit yang dipakai bersama oleh ketiga form panel beranda. */
export function FormFeedback({ state }: { state: { error?: string; success?: string } | null }) {
  if (state?.error) {
    return (
      <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md" role="alert">
        {state.error}
      </p>
    )
  }
  if (state?.success) {
    return (
      <p
        className="flex items-center gap-1.5 text-sm text-primary bg-primary/10 px-3 py-2 rounded-md"
        role="status"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {state.success}
      </p>
    )
  }
  return null
}
