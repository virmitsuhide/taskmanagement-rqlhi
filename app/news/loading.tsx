import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b h-14 flex items-center px-6">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="max-w-6xl mx-auto px-6 pt-9 pb-16 space-y-7">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-1 border-b pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-[1.6fr_1fr] gap-6">
          <Skeleton className="aspect-[16/10] rounded-xl" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
