import { request } from './http'

export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type IssuePriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface NoteSummary {
  id: string
  title: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  childCount?: number
  /** Present on a note's children when fetched through getNote. */
  status?: IssueStatus
}

export interface Criterion {
  id: string
  noteId: string
  text: string
  done: boolean
  position: number
}

export interface Comment {
  id: string
  noteId: string
  authorId: string
  body: string
  createdAt: string
  author: { id: string; name: string | null; email: string; image: string | null }
}

export interface Note extends NoteSummary {
  content: string
  status: IssueStatus
  priority: IssuePriority
  labels: string[]
  /** Pins this note to one SOP instead of inheriting its module default. */
  sopOverrideId?: string | null
  /** Values SOP conditions read as fields.<key> (e.g. riskLevel). */
  customFields?: Record<string, CustomFieldValue>
  /** getNote includes these three; create/update responses don't. */
  children?: NoteSummary[]
  criteria?: Criterion[]
  comments?: Comment[]
}

export type CustomFieldValue = string | number | boolean | null | (string | number)[]

export interface NotePatch {
  title?: string
  content?: string
  status?: IssueStatus
  priority?: IssuePriority
  labels?: string[]
  sopOverrideId?: string | null
  customFields?: Record<string, CustomFieldValue>
}

export interface SearchHit {
  id: string
  title: string
  snippet: string
  breadcrumb: { id: string; title: string }[]
}

export const listNotes = (parentId?: string) =>
  request<{ notes: NoteSummary[] }>(`/api/notes${parentId ? `?parentId=${parentId}` : ''}`).then((d) => d.notes)

// The backend may omit the issue fields (status/priority/labels); fill defaults so the UI never reads undefined.
const withDefaults = (n: Partial<Note> & NoteSummary): Note => ({
  ...n,
  content: n.content ?? '',
  status: n.status ?? 'TODO',
  priority: n.priority ?? 'MEDIUM',
  labels: n.labels ?? [],
})

export const getNote = (id: string) => request<{ note: Note }>(`/api/notes/${id}`).then((d) => withDefaults(d.note))

export const createNote = (parentId: string | null, title = 'Untitled') =>
  request<{ note: Note }>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content: '', parentId }),
  }).then((d) => withDefaults(d.note))

export const updateNote = (id: string, body: NotePatch) =>
  request<{ note: Note }>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then((d) =>
    withDefaults(d.note),
  )

export const deleteNote = (id: string) => request<unknown>(`/api/notes/${id}`, { method: 'DELETE' })

export const searchNotes = (q: string) =>
  request<{ results: SearchHit[] }>(`/api/notes/search?q=${encodeURIComponent(q)}`).then((d) => d.results)

export const moveNote = (id: string, parentId: string | null) =>
  request<{ note: Note }>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ parentId }) }).then((d) => d.note)

export const addCriterion = (noteId: string, text: string) =>
  request<{ criterion: Criterion }>(`/api/notes/${noteId}/criteria`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }).then((d) => d.criterion)

export const updateCriterion = (noteId: string, id: string, body: { text?: string; done?: boolean }) =>
  request<{ criterion: Criterion }>(`/api/notes/${noteId}/criteria/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).then((d) => d.criterion)

export const deleteCriterion = (noteId: string, id: string) =>
  request<unknown>(`/api/notes/${noteId}/criteria/${id}`, { method: 'DELETE' })

export const addComment = (noteId: string, body: string) =>
  request<{ comment: Comment }>(`/api/notes/${noteId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  }).then((d) => d.comment)

export const deleteComment = (noteId: string, id: string) =>
  request<unknown>(`/api/notes/${noteId}/comments/${id}`, { method: 'DELETE' })
