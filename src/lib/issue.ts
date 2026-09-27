import type { IssuePriority, IssueStatus } from '../api/notes'

export const STATUSES: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export const STATUS_LABEL: Record<IssueStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const PRIORITIES: IssuePriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  URGENT: 'Urgent / P1',
  HIGH: 'High / P2',
  MEDIUM: 'Medium / P3',
  LOW: 'Low / P4',
}

export const issueKey = (id: string) => `LN-${id.slice(-5).toUpperCase()}`
