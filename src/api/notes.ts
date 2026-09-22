export interface NoteSummary {
  id: string
  title: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  childCount?: number
}

export interface Note extends NoteSummary {
  content: string
  children?: NoteSummary[]
}

export interface SearchHit {
  id: string
  title: string
  snippet: string
  breadcrumb: { id: string; title: string }[]
}

const BASE_URL = import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:3000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data as T
}

export const listNotes = (parentId?: string) =>
  request<{ notes: NoteSummary[] }>(`/api/notes${parentId ? `?parentId=${parentId}` : ''}`).then((d) => d.notes)

export const getNote = (id: string) => request<{ note: Note }>(`/api/notes/${id}`).then((d) => d.note)

export const createNote = (parentId: string | null, title = 'Untitled') =>
  request<{ note: Note }>('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content: '', parentId }),
  }).then((d) => d.note)

export const updateNote = (id: string, body: { title: string; content: string }) =>
  request<{ note: Note }>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then((d) => d.note)

export const deleteNote = (id: string) => request<unknown>(`/api/notes/${id}`, { method: 'DELETE' })

export const searchNotes = (q: string) =>
  request<{ results: SearchHit[] }>(`/api/notes/search?q=${encodeURIComponent(q)}`).then((d) => d.results)

export const moveNote = (id: string, parentId: string | null) =>
  request<{ note: Note }>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ parentId }) }).then((d) => d.note)
