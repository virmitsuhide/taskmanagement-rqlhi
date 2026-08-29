import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-[70px] w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
