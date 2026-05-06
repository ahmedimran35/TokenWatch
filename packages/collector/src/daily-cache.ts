import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CACHE_DIR = path.join(os.homedir(), '.tokenwatch', 'cache')
const DAILY_CACHE_FILE = path.join(CACHE_DIR, 'daily-aggregates.json')

export interface DailyAggregate {
  date: string
  totalTokens: number
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  sessionCount: number
  topModel: string
  topProject: string
}

export function loadDailyCache(): DailyAggregate[] {
  try {
    const raw = fs.readFileSync(DAILY_CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveDailyCache(aggregates: DailyAggregate[]): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(DAILY_CACHE_FILE, JSON.stringify(aggregates, null, 2), { mode: 0o600, encoding: 'utf-8' })
  } catch {
    // ignore
  }
}

export function invalidateDailyCache(since: string): void {
  try {
    const cached = loadDailyCache()
    const filtered = cached.filter((a) => a.date < since)
    if (filtered.length !== cached.length) {
      saveDailyCache(filtered)
    }
  } catch {
    // ignore
  }
}
