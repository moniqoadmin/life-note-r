import type { Location } from 'react-router-dom'

/** Where to send someone after they sign in: the page they were bounced from, else the dashboard. */
export function postLoginPath(state: unknown) {
  const from = (state as { from?: Location } | null)?.from
  return from && from.pathname !== '/login' ? `${from.pathname}${from.search}${from.hash}` : '/dashboard'
}
