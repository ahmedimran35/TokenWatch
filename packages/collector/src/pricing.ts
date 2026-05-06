import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CACHE_DIR = path.join(os.homedir(), '.tokenwatch', 'cache')
const PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const CACHE_FILE = path.join(CACHE_DIR, 'litellm-pricing.json')
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Hardcoded fallbacks for critical models
const FALLBACK_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4-5': { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-opus-4-6': { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  'claude-haiku-4-6': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  'gpt-4o': { input: 2.50, output: 10, cacheRead: 1.25, cacheWrite: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cacheRead: 0.075, cacheWrite: 0.60 },
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  'gpt-5-mini': { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0.25 },
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 1.25 },
  'gemini-2.5-flash': { input: 0.15, output: 3.50, cacheRead: 0.038, cacheWrite: 0.15 },
  'o3': { input: 10, output: 40, cacheRead: 2.50, cacheWrite: 10 },
  'o3-mini': { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 1.10 },
  'o4-mini': { input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 1.10 },
}

export interface ModelPrice {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

let pricingCache: Record<string, any> | null = null
let cacheLoadedAt = 0

async function fetchLiteLLMPricing(): Promise<Record<string, any>> {
  try {
    const res = await fetch(PRICING_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data as Record<string, any>
  } catch {
    return {}
  }
}

function loadCache(): Record<string, any> | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed._cachedAt && Date.now() - parsed._cachedAt < CACHE_TTL) {
      return parsed
    }
  } catch {
    // cache miss or expired
  }
  return null
}

function saveCache(data: Record<string, any>): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    }
    const toSave = { ...data, _cachedAt: Date.now() }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(toSave), { mode: 0o600, encoding: 'utf-8' })
  } catch {
    // ignore write errors
  }
}

export async function ensurePricingLoaded(): Promise<void> {
  if (pricingCache && Date.now() - cacheLoadedAt < CACHE_TTL) return

  const cached = loadCache()
  if (cached) {
    pricingCache = cached
    cacheLoadedAt = Date.now()
    return
  }

  pricingCache = await fetchLiteLLMPricing()
  if (Object.keys(pricingCache).length > 0) {
    saveCache(pricingCache)
  }
  cacheLoadedAt = Date.now()
}

function normalizeModelName(model: string): string {
  return model.toLowerCase().replace(/[_\s]+/g, '-').replace(/^claude[-_]?/, 'claude-')
}

function resolveModel(model: string, aliases: Record<string, string>): string {
  const normalized = normalizeModelName(model)
  if (aliases[normalized]) return aliases[normalized]
  return normalized
}

function getFromCache(model: string): ModelPrice | null {
  if (!pricingCache) return null
  const data = pricingCache[model]
  if (!data) return null

  const normalize = (perToken: number | undefined, perMillion: number | undefined): number => {
    if (perMillion !== undefined) return perMillion
    if (perToken !== undefined && perToken > 0) return perToken * 1_000_000
    return 0
  }

  const inputBase = data.input_cost_per_token
  const inputAlt = data.input_cost_per_million
  const outputBase = data.output_cost_per_token
  const outputAlt = data.output_cost_per_million

  return {
    input: normalize(inputBase, inputAlt),
    output: normalize(outputBase, outputAlt),
    cacheRead: normalize(data.cache_read_cost_per_token, data.cache_read_cost_per_million) || normalize(inputBase, inputAlt) * 0.5 || 0,
    cacheWrite: normalize(data.cache_creation_cost_per_token, data.cache_creation_cost_per_million) || normalize(inputBase, inputAlt) * 1.25 || 0,
  }
}

function getFromFallback(model: string): ModelPrice | null {
  const normalized = normalizeModelName(model)
  if (FALLBACK_PRICING[normalized]) return FALLBACK_PRICING[normalized]
  for (const [key, price] of Object.entries(FALLBACK_PRICING)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) return price
  }
  return null
}

export function getPriceForModel(model: string, aliases: Record<string, string> = {}): ModelPrice {
  const resolved = resolveModel(model, aliases)

  const cached = getFromCache(resolved)
  if (cached && cached.input > 0) return cached

  const fallback = getFromFallback(resolved)
  if (fallback) return fallback

  return { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 }
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  aliases: Record<string, string> = {}
): number {
  const pricing = getPriceForModel(model, aliases)

  const inputCost = (inputTokens * pricing.input) / 1_000_000
  const outputCost = (outputTokens * pricing.output) / 1_000_000
  const cacheReadCost = (cacheReadTokens * pricing.cacheRead) / 1_000_000
  const cacheWriteCost = (cacheWriteTokens * pricing.cacheWrite) / 1_000_000

  return inputCost + outputCost + cacheReadCost + cacheWriteCost
}
