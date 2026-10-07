const raw = (import.meta.env.VITE_AUTH_API_URL ?? 'http://localhost:3000').trim()

export const BASE_URL = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '')
