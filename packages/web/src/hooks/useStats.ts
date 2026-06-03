import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || res.statusText)
  }
  return res.json()
}

export function useLiveStats() {
  return useQuery({
    queryKey: ['live'],
    queryFn: () => fetchJson('/api/stats/live'),
    refetchInterval: 5000,
  })
}

export function useOverviewStats(from: Date, to: Date) {
  return useQuery({
    queryKey: ['overview', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/stats/overview?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useProjects(from: Date, to: Date, limit = 20) {
  return useQuery({
    queryKey: ['projects', from.toISOString(), to.toISOString(), limit],
    queryFn: () =>
      fetchJson(`/api/projects?from=${from.toISOString()}&to=${to.toISOString()}&limit=${limit}`),
  })
}

export function useSessions(from: Date, to: Date, limit = 10, sortBy = 'cost') {
  return useQuery({
    queryKey: ['sessions', from.toISOString(), to.toISOString(), limit, sortBy],
    queryFn: () =>
      fetchJson(
        `/api/sessions?from=${from.toISOString()}&to=${to.toISOString()}&limit=${limit}&sortBy=${sortBy}`
      ),
  })
}

export function useSessionTimeline(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchJson(`/api/sessions/${sessionId}`),
    enabled: !!sessionId,
  })
}

export function useModels(from: Date, to: Date) {
  return useQuery({
    queryKey: ['models', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/models?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useCacheStats(from: Date, to: Date) {
  return useQuery({
    queryKey: ['cache', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/cache/stats?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useBurnRateHistory(periodHours = 24, bucketMinutes = 5) {
  return useQuery({
    queryKey: ['burnRateHistory', periodHours, bucketMinutes],
    queryFn: () =>
      fetchJson(`/api/stats/burn-rate-history?periodHours=${periodHours}&bucketMinutes=${bucketMinutes}`),
    refetchInterval: 10000,
  })
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchJson('/api/alerts'),
    refetchInterval: 15000,
  })
}

export function useBudgetUtilization() {
  return useQuery({
    queryKey: ['budgetUtilization'],
    queryFn: () => fetchJson('/api/alerts/budget-utilization'),
    refetchInterval: 15000,
  })
}

export function useAlertConfig() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['alertConfig'],
    queryFn: () => fetchJson('/api/alerts/config'),
  })
}

export function useUpdateFromWebSocket() {
  const queryClient = useQueryClient()
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const authToken = import.meta.env.VITE_TOKENWATCH_AUTH_TOKEN || ''
  const wsUrl = authToken
    ? `${wsProtocol}//${window.location.host}/ws?token=${encodeURIComponent(authToken)}`
    : `${wsProtocol}//${window.location.host}/ws`
  const { lastMessage } = useWebSocket(wsUrl)

  useEffect(() => {
    if (!lastMessage) return

    if (lastMessage.type === 'token_event') {
      queryClient.invalidateQueries({ queryKey: ['live'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      queryClient.invalidateQueries({ queryKey: ['tools'] })
      queryClient.invalidateQueries({ queryKey: ['shellCommands'] })
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    }
    if (lastMessage.type === 'burn_rate_update') {
      queryClient.invalidateQueries({ queryKey: ['live'] })
      queryClient.invalidateQueries({ queryKey: ['burnRateHistory'] })
    }
    if (lastMessage.type === 'session_update') {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['live'] })
    }
    if (lastMessage.type === 'alert') {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    }
  }, [lastMessage, queryClient])
}

export function useTools(from: Date, to: Date) {
  return useQuery({
    queryKey: ['tools', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/tools?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useShellCommands(from: Date, to: Date) {
  return useQuery({
    queryKey: ['shellCommands', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/tools/shell-commands?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useActivities(from: Date, to: Date) {
  return useQuery({
    queryKey: ['activities', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/tools/activities?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useForecast() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: () => fetchJson('/api/stats/forecast'),
    refetchInterval: 60000,
  })
}

export function useSessionEvents(sessionId: string) {
  return useQuery({
    queryKey: ['sessionEvents', sessionId],
    queryFn: () => fetchJson(`/api/sessions/${sessionId}/events`),
    enabled: !!sessionId,
  })
}

export function useModelCompare(from: Date, to: Date) {
  return useQuery({
    queryKey: ['modelCompare', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/stats/model-compare?from=${from.toISOString()}&to=${to.toISOString()}`),
  })
}

export function useOptimize(from: Date, to: Date) {
  return useQuery({
    queryKey: ['optimize', from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson(`/api/stats/optimize?from=${from.toISOString()}&to=${to.toISOString()}`),
    refetchInterval: 300000,
  })
}

export function useYield(from: Date, to: Date, projectPath?: string) {
  return useQuery({
    queryKey: ['yield', from.toISOString(), to.toISOString(), projectPath],
    queryFn: () => {
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
      if (projectPath) params.set('projectPath', projectPath)
      return fetchJson(`/api/stats/yield?${params}`)
    },
    refetchInterval: 60000,
  })
}
