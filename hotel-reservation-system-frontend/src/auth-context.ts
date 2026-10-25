import { createContext, useContext } from 'react'
import type { User } from './types'
export interface Session { user: User | null; loading: boolean; error: string; login(username: string, password: string): Promise<void>; logout(): Promise<void> }
export const AuthContext = createContext<Session | null>(null)
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('Falta AuthProvider'); return auth }
