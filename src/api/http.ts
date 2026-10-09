import { BASE_URL } from './baseUrl'

/** Error from the backend's `{ error: { code, message } }` body. */
export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data?.error
    // Most routes send { error: { code, message } }; a few older ones send a plain string.
    const message = typeof err === 'string' ? err : (err?.message ?? 'Something went wrong')
    throw new ApiError(message, res.status, typeof err === 'object' ? err?.code : undefined)
  }
  return data as T
}

export const jsonBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
