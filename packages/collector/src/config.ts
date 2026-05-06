import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CONFIG_DIR = path.join(os.homedir(), '.tokenwatch')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const CACHE_DIR = path.join(CONFIG_DIR, 'cache')
const RATE_CACHE_FILE = path.join(CACHE_DIR, 'exchange-rates.json')
const RATE_CACHE_TTL = 24 * 60 * 60 * 1000

export interface TokenWatchConfig {
  currency?: string
  modelAliases?: Record<string, string>
  plan?: { type: string; monthlyUsd: number }
}

function loadConfig(): TokenWatchConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveConfig(config: TokenWatchConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }
  const existing = loadConfig()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, ...config }, null, 2), { mode: 0o600 })
}

export function getCurrency(): string {
  return loadConfig().currency || 'USD'
}

export function setCurrency(currency: string): void {
  saveConfig({ currency: currency.toUpperCase() })
}

export function getModelAliases(): Record<string, string> {
  return loadConfig().modelAliases || {}
}

export function setModelAlias(alias: string, target: string): void {
  const config = loadConfig()
  const aliases = config.modelAliases || {}
  aliases[alias.toLowerCase()] = target
  saveConfig({ modelAliases: aliases })
}

export function removeModelAlias(alias: string): void {
  const config = loadConfig()
  const aliases = config.modelAliases || {}
  delete aliases[alias.toLowerCase()]
  saveConfig({ modelAliases: aliases })
}

export function getPlan(): { type: string; monthlyUsd: number } | null {
  return loadConfig().plan || null
}

export function setPlan(type: string, monthlyUsd: number): void {
  if (type === 'none') {
    const config = loadConfig()
    delete config.plan
    saveConfig(config)
    return
  }
  saveConfig({ plan: { type, monthlyUsd } })
}

const RATE_CACHE: Record<string, number> = {}
let rateCacheLoadedAt = 0

async function fetchExchangeRate(targetCurrency: string): Promise<number> {
  if (targetCurrency === 'USD') return 1
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${targetCurrency}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.rates?.[targetCurrency] || 1
  } catch {
    return 1
  }
}

function loadRateCache(): void {
  try {
    const raw = fs.readFileSync(RATE_CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed._cachedAt && Date.now() - parsed._cachedAt < RATE_CACHE_TTL) {
      Object.assign(RATE_CACHE, parsed)
      rateCacheLoadedAt = Date.now()
    }
  } catch {
    // ignore
  }
}

function saveRateCache(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(RATE_CACHE_FILE, JSON.stringify({ ...RATE_CACHE, _cachedAt: Date.now() }), { mode: 0o600 })
  } catch {
    // ignore
  }
}

export async function convertUsd(amount: number, targetCurrency?: string): Promise<number> {
  const currency = targetCurrency || getCurrency()
  if (currency === 'USD') return amount

  loadRateCache()
  if (RATE_CACHE[currency] && Date.now() - rateCacheLoadedAt < RATE_CACHE_TTL) {
    return amount * RATE_CACHE[currency]
  }

  const rate = await fetchExchangeRate(currency)
  RATE_CACHE[currency] = rate
  saveRateCache()
  return amount * rate
}

export async function formatCurrency(amount: number, targetCurrency?: string): Promise<string> {
  const currency = targetCurrency || getCurrency()
  const symbol = currencySymbols[currency] || currency
  const converted = await convertUsd(amount, currency)
  if (converted >= 100) return `${symbol}${converted.toFixed(0)}`
  if (converted >= 1) return `${symbol}${converted.toFixed(2)}`
  return `${symbol}${converted.toFixed(4)}`
}

const currencySymbols: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', CNY: '¥', INR: '₹', KRW: '₩', BRL: 'R$',
}
