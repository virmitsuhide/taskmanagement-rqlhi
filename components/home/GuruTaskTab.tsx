import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PublicPost } from '@/types'

interface Props {
  posts: PublicPost[]
  emptyMessage?: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export function GuruTaskTab({ posts, emptyMessage = 'Belum ada tugas.' }: Props) {
  if (posts.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map(post => {
        const overdue = isOverdue(post.due_date)
        return (
          <Card key={post.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">{post.title}</CardTitle>
                {post.due_date && (
                  <Badge
                    variant={overdue ? 'destructive' : 'secondary'}
                    className="shrink-0 text-xs"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {overdue ? 'Terlambat' : formatDate(post.due_date)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{post.content}</p>
              {post.due_date && !overdue && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Deadline: {formatDate(post.due_date)}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
