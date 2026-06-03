import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div role="status" aria-busy="true" className="p-4 md:p-6 max-w-md">
        <span className="sr-only">Memuat…</span>
        <Skeleton className="mb-6 h-24 w-full rounded-lg" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-8 w-28" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
