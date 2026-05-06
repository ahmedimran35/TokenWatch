import { useQuery } from '@tanstack/react-query'

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || res.statusText)
  }
  return res.json()
}

export function useContextWaste(from: Date, to: Date) {
  return useQuery({
    queryKey: ['contextWaste', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/health-insights/waste?from=${from.toISOString()}&to=${to.toISOString()}`),
    refetchInterval: 30000,
  })
}

export function useZombieSessions(thresholdMinutes = 30) {
  return useQuery({
    queryKey: ['zombieSessions', thresholdMinutes],
    queryFn: () =>
      fetchJson(`/api/health-insights/zombies?threshold=${thresholdMinutes}`),
    refetchInterval: 15000,
  })
}

export function useSessionHealthScores(from: Date, to: Date) {
  return useQuery({
    queryKey: ['sessionHealthScores', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/health-insights/scores?from=${from.toISOString()}&to=${to.toISOString()}`),
    refetchInterval: 30000,
  })
}
