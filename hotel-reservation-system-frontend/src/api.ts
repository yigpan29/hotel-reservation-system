const base = import.meta.env.VITE_API_BASE || '/api'
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
    const tokenResponse = await fetch(base + '/auth/csrf', { credentials: 'include' })
    if (!tokenResponse.ok) throw new ApiError(tokenResponse.status, 'No se pudo obtener protección CSRF (HTTP ' + tokenResponse.status + '). Comprueba que el backend esté disponible.')
    const csrf: { token: string; headerName: string } = await tokenResponse.json()
    headers.set(csrf.headerName, csrf.token)
  }
  const response = await fetch(base + path, { ...options, headers, credentials: 'include' })
  if (!response.ok) {
    const failure: { message?: string; fields?: Record<string, string> } = await response.json().catch(() => ({}))
    const details = failure.fields ? ' · ' + Object.entries(failure.fields).map(([key, value]) => key + ': ' + value).join(' · ') : ''
    throw new ApiError(response.status, (failure.message || 'Error de servidor (' + response.status + ')') + details)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export function message(error: unknown) { return error instanceof Error ? error.message : 'No se pudo completar la operación' }
