'use client'

import { useState, useTransition } from 'react'
import { updateTaskStatusAction } from '@/app/actions/tasks'
import type { TaskStatus } from '@/types'

export function useTaskStatus(taskId: string, initialStatus: TaskStatus) {
  const [status, setStatus] = useState(initialStatus)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const changeStatus = (newStatus: TaskStatus, notes?: string) => {
    startTransition(async () => {
      const result = await updateTaskStatusAction(taskId, newStatus, notes)
      if (result?.error) {
        setError(result.error)
      } else {
        setStatus(newStatus)
        setError(null)
      }
    })
  }

  return { status, isPending, error, changeStatus }
}
