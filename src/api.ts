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

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, token)
  }
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
  const isLoginRequest = path === '/api/auth/login'
  if (token !== null && !isLoginRequest) {
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
  const payload: unknown = text.length === 0 ? null : JSON.parse(text)
  if (!response.ok) {
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
