import { queryClient } from '../lib/query-client'
import { BASE_URL } from './baseUrl'

/** JSON request against the backend with the session cookie; throws the backend's error message. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  // The session expired or was revoked: re-check it so RequireAuth sends the user to
  // /login (and back here afterwards) instead of leaving them on a page of errors.
  if (res.status === 401) queryClient.invalidateQueries({ queryKey: ['session'] })
  const data = await res.json().catch(() => ({}))
  // Errors arrive as { error: { code, message } } (older routes send { error: string }).
  if (!res.ok) throw new Error(data.error?.message ?? (typeof data.error === 'string' ? data.error : 'Something went wrong'))
  return data as T
}
