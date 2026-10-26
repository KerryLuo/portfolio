// In dev, Vite proxies /api to the local backend. In production set
// VITE_API_URL to the deployed backend's origin (see frontend/.env.example).
const BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export const apiEnabled = import.meta.env.DEV || BASE !== ''

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: json ? { 'Content-Type': 'application/json' } : undefined,
    body: json ? JSON.stringify(json) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error ?? 'Request failed', res.status, data.fields)
  }
  return data as T
}
