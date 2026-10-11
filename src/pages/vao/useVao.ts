import { useCallback, useEffect, useState } from 'react'

import { ApiError, get } from '../../api'

export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e)
}

/** Loads a VAO endpoint and exposes a reload function for after an action. */
export function useVaoResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (path == null) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setData(await get<T>(path))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload }
}
