import { Calendar, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PublicPost } from '@/types'

interface Props {
  post: PublicPost
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function AnnouncementCard({ post }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{post.title}</CardTitle>
          {post.target !== 'all' && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {post.target.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(post.created_at)}
          </span>
          {post.creator && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {post.creator.display_name}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{post.content}</p>
        {post.due_date && (
          <p className="mt-3 text-xs font-medium text-amber-600">
            Deadline: {formatDate(post.due_date)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
