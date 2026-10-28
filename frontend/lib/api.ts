import type { ApiError } from './types'

// Written out in full: Next only inlines NEXT_PUBLIC_ vars into the browser bundle when the
// name is spelled out. process.env[name] would be undefined in the browser.
const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL must be set in frontend/.env.local')
}

// Either the data, or an error. `status` is 0 when the API couldn't be reached at all.
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError }

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
}

// Every call to the API goes through here
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      // Send the session cookies, and store the ones the API sets. Without this the browser drops them.
      credentials: 'include',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })
  } catch {
    // fetch only throws when there's no response at all: API down, wrong URL, CORS
    return { ok: false, status: 0, error: { error: 'Could not reach the server' } }
  }

  // 204 has no body
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null)

  if (res.ok) {
    // We trust the API to send the shape the caller asked for (T). TypeScript can't check data
    // that arrives at runtime, so this cast is the one place we step outside its rules.
    return { ok: true, status: res.status, data: body as T }
  }
  return {
    ok: false,
    status: res.status,
    error: isApiError(body) ? body : { error: 'Something went wrong' }
  }
}
