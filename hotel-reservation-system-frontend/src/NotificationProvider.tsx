import { useEffect, useState, type ReactNode } from 'react'
import { api, message } from './api'
import { useAuth } from './auth-context'
import { NotificationContext } from './notification-context'
export default function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState({ username: '', count: null as number | null, error: '' })
  useEffect(() => {
    if (!user) return
    const username = user.username
    let active = true, request: AbortController | null = null
    function refresh() {
      request?.abort(); const current = new AbortController(); request = current
      api<{ unreadCount: number }>('/notifications/unread-count', { signal: current.signal })
        .then(result => { if (active && !current.signal.aborted) setState({ username, count: result.unreadCount, error: '' }) })
        .catch(error => { if (active && !current.signal.aborted) setState({ username, count: null, error: message(error) }) })
    }
    refresh(); const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh); window.addEventListener('notifications-updated', refresh)
    return () => { active = false; request?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('notifications-updated', refresh) }
  }, [user])
  const value = user && user.username === state.username ? state : { count: null, error: '' }
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
