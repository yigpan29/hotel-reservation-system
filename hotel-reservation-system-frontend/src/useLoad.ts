import { useCallback, useEffect, useState } from 'react'
import { api, message } from './api'
export function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let current = true
    setLoading(true); setError('')
    api<T>(url).then(value => { if (current) setData(value) }).catch(error => { if (current) setError(message(error)) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [url, revision])
  return { data, loading, error, reload }
}
