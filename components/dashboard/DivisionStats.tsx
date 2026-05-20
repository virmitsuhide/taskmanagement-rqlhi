import { AlertCircle, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  urgentCount: number
  dueSoonCount: number
  pendingVerifCount: number
  inProgressCount: number
}

export function DivisionStats({ urgentCount, dueSoonCount, pendingVerifCount, inProgressCount }: Props) {
  const stats = [
    {
      label: 'Mendesak',
      value: urgentCount,
      icon: <AlertCircle className="h-4 w-4 text-destructive" />,
      highlight: urgentCount > 0,
    },
    {
      label: 'Deadline Dekat',
      value: dueSoonCount,
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      highlight: dueSoonCount > 0,
    },
    {
      label: 'Perlu Verifikasi',
      value: pendingVerifCount,
      icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
      highlight: pendingVerifCount > 0,
    },
    {
      label: 'Sedang Dikerjakan',
      value: inProgressCount,
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
      highlight: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(stat => (
        <Card key={stat.label} className={stat.highlight ? 'border-primary/30' : ''}>
          <CardHeader className="pb-1 pt-4 px-4">
            <div className="flex items-center justify-between">
              {stat.icon}
              <span className="text-2xl font-bold">{stat.value}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
