export type Json = Record<string, unknown>


export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const TOKEN_KEY = 'slate.accessToken'
const TOKEN_EXPIRY_KEY = 'slate.accessTokenExpiresAt'
const LAST_ACTIVITY_KEY = 'slate.lastActivityAt'
export const SESSION_EXPIRED_EVENT = 'slate:session-expired'

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string | null, expiresAt?: string): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, token)
    if (expiresAt !== undefined) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt)
    }
  }
}

export function storedTokenExpiry(): number | null {
  const value = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (value === null) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

export function recordActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

export function storedLastActivity(): number | null {
  const value = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (value === null) return null
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  options?: { idempotent?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = storedToken()
  const isPublicAuthRequest = path === '/api/auth/public-key'
    || path === '/api/auth/login'
    || path === '/api/auth/mfa/verify'
    || path === '/api/auth/password-reset/request'
    || path === '/api/auth/password-reset/confirm'
  if (token !== null && !isPublicAuthRequest) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options?.idempotent === true) {
    headers['Idempotency-Key'] = newIdempotencyKey()
  }
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload: unknown = null
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch (e) {
      if (response.ok || !(e instanceof SyntaxError)) throw e
    }
  }
  if (!response.ok) {
    if (response.status === 401 && token !== null && !isPublicAuthRequest) {
      storeToken(null)
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    const problem = (payload ?? {}) as { code?: string; message?: string; details?: unknown }
    throw new ApiError(
      response.status,
      problem.code ?? 'ERROR',
      problem.message ?? `${method} ${path} failed with ${response.status}`,
      problem.details,
    )
  }
  return payload as T
}

export const get = <T,>(path: string) => api<T>('GET', path)
export const post = <T,>(path: string, body?: unknown, idempotent = false) =>
  api<T>('POST', path, body ?? {}, { idempotent })
export const put = <T,>(path: string, body: unknown) => api<T>('PUT', path, body)

export function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length > 0) {
      search.set(key, String(value))
    }
  }
  const encoded = search.toString()
  return encoded.length === 0 ? '' : `?${encoded}`
}
