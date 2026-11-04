import { get, post } from './request'
import type { ScheduledTask } from '@/types'

export function getScheduledTasks() {
  return get<ScheduledTask[]>('/scheduled-task/list')
}

export function executeScheduledTask(taskKey: string) {
  return post<ScheduledTask>(`/scheduled-task/execute/${taskKey}`)
}