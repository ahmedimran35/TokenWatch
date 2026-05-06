export function formatCost(costUsd: number): string {
  if (costUsd < 0.0001) return '$0.00'
  if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`
  if (costUsd < 1) return `$${costUsd.toFixed(3)}`
  return `$${costUsd.toFixed(2)}`
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function encodeProjectPath(path: string): string {
  return path.replace(/\//g, '-').replace(/^-/, '')
}

export function decodeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/')
}