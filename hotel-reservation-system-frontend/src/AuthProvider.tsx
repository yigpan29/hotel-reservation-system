import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, message } from './api'
import type { User } from './types'
import { AuthContext } from './auth-context'
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  useEffect(() => { api<User>('/auth/me').then(setUser).catch(error => { if (!(error instanceof ApiError && error.status === 401)) setError(message(error)) }).finally(() => setLoading(false)) }, [])
  async function login(username: string, password: string) { setUser(await api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })); setError('') }
  async function logout() { await api<void>('/auth/logout', { method: 'POST' }); setUser(null) }
  return <AuthContext.Provider value={{ user, loading, error, login, logout }}>{children}</AuthContext.Provider>
}
