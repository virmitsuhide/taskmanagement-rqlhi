import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div role="status" aria-busy="true" className="p-4 md:p-6 max-w-3xl">
        <span className="sr-only">Memuat…</span>
        <Skeleton className="mb-6 h-4 w-56" />
        <Skeleton className="mb-2 h-28 w-full rounded-xl" />
        <Skeleton className="mb-6 h-8 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
