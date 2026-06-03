import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div role="status" aria-busy="true" className="p-4 md:p-6 max-w-3xl">
        <span className="sr-only">Memuat…</span>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
