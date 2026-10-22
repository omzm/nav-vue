/** 统一的 API 请求封装：同源 /api，自动携带 cookie */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { headers: extraHeaders, ...rest } = init
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `请求失败（${res.status}）`) as Error & {
      status: number
      data: unknown
    }
    err.status = res.status
    err.data = data
    throw err
  }
  return data as T
}

export const get = <T>(path: string) => api<T>(path)
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const put = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })
