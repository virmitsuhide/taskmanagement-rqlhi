import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div>
      <div className="sticky top-0 z-40 border-b bg-background h-14 flex items-center px-4 gap-3">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        {Array.from({ length: 3 }).map((_, sec) => (
          <div key={sec} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
