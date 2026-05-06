#!/usr/bin/env node

import { Command } from 'commander'
import { Database, startCollector, getCurrency, setCurrency, getModelAliases, setModelAlias, removeModelAlias, convertUsd } from '@tokenwatch/collector'
import {
  calculateBurnRate,
  getToday,
  getThisMonth,
  getThisWeek,
  getLast30Days,
  getAllTime,
  getStats,
  getActivityStats,
  getToolStats,
  getShellCommandStats,
  calculateForecast,
  getBurnRateHistory,
  getTopSessions,
  getModelStats,
  getProjectStats,
  compareModels,
  analyzeOptimizations,
  analyzeYield,
} from '@tokenwatch/engine'
import type { DailyStats, ProjectStats, ModelStats } from '@tokenwatch/types'

const program = new Command()

program
  .name('tokenwatch')
  .description('AI coding token usage tracker and cost observability')
  .version('0.1.0')

async function getDb(): Promise<Database> {
  const { db } = await startCollector()
  return db
}

function parsePeriod(period: string | undefined): { from: Date; to: Date; label: string } {
  const now = new Date()
  let from: Date
  let label: string

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      label = 'Today'
      break
    case 'week':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      label = 'Last 7 days'
      break
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      label = 'This month'
      break
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      label = 'Last 30 days'
      break
    case '6m':
      from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      label = 'Last 6 months'
      break
    case 'all':
      from = new Date(0)
      label = 'All time'
      break
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      label = 'Last 7 days'
  }

  return { from, to: now, label }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function printHeader(label: string, width = 60) {
  const padding = '═'.repeat((width - label.length - 2) / 2)
  console.log(`\n${padding} ${label} ${padding}`)
}

function printRow(label: string, value: string, width = 60) {
  const labelPad = label.padEnd(24)
  console.log(`  ${labelPad} ${value}`)
}

program
  .command('status')
  .description('Quick overview of today and month totals')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .action(async (opts) => {
    const db = await getDb()
    const today = getToday(db)
    const month = getThisMonth(db)
    const burnRate = calculateBurnRate(db, 5)

    if (opts.format === 'json') {
      console.log(JSON.stringify({
        today: {
          cost: today.totalCostUsd,
          tokens: today.totalTokens,
          sessions: today.sessionCount,
        },
        month: {
          cost: month.totalCostUsd,
          tokens: month.totalTokens,
          sessions: month.sessionCount,
        },
        burnRate: {
          tokensPerMinute: burnRate.tokensPerMinute,
          costPerHour: burnRate.costPerHour,
        },
      }, null, 2))
    } else {
      console.log('\n◇ tokenwatch')
      printHeader('STATUS')
      printRow('Today cost:', formatCost(today.totalCostUsd))
      printRow('Today tokens:', formatNumber(today.totalTokens))
      printRow('Today sessions:', today.sessionCount.toString())
      console.log('')
      printRow('Month cost:', formatCost(month.totalCostUsd))
      printRow('Month tokens:', formatNumber(month.totalTokens))
      printRow('Month sessions:', month.sessionCount.toString())
      console.log('')
      printRow('Burn rate:', `${burnRate.tokensPerMinute} tokens/min`)
      printRow('Cost/hour:', formatCost(burnRate.costPerHour) + '/hr')
      console.log('')
    }

    db.close()
  })

program
  .command('today')
  .description("Today's AI usage")
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .option('--verbose', 'Show detailed breakdown')
  .action(async (opts) => {
    const db = await getDb()
    const stats = getToday(db)

    if (opts.format === 'json') {
      console.log(JSON.stringify(stats, null, 2))
    } else {
      console.log('\n◇ tokenwatch')
      printHeader("TODAY'S USAGE")
      printRow('Total cost:', formatCost(stats.totalCostUsd))
      printRow('Total tokens:', formatNumber(stats.totalTokens))
      printRow('Sessions:', stats.sessionCount.toString())
      printRow('Cache hit rate:', `${(stats.cacheHitRate * 100).toFixed(1)}%`)
      console.log('')

      if (opts.verbose) {
        printRow('Input tokens:', formatNumber(stats.totalInputTokens))
        printRow('Output tokens:', formatNumber(stats.totalOutputTokens))
        printRow('Cache read:', formatNumber(stats.totalCacheReadTokens))
        printRow('Avg cost/session:', formatCost(stats.avgCostPerSession))
        printRow('Avg tokens/session:', formatNumber(stats.avgTokensPerSession))
        console.log('')

        if (stats.dailyBreakdown.length > 0) {
          console.log('  Daily breakdown:')
          for (const day of stats.dailyBreakdown) {
            const d = day as DailyStats
            console.log(`    ${d.date}: ${formatCost(d.totalCostUsd)} · ${formatNumber(d.totalTokens)} tokens · ${d.sessionCount} sessions`)
          }
          console.log('')
        }
      }
    }

    db.close()
  })

program
  .command('report')
  .description('Detailed usage report')
  .option('-p, --period <period>', 'Time period (today, week, month, 30d, 6m, all)', '7d')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--verbose', 'Show all breakdowns')
  .action(async (opts) => {
    const db = await getDb()

    let from: Date, to: Date, label: string

    if (opts.from) {
      from = new Date(opts.from)
      to = opts.to ? new Date(opts.to) : new Date()
      label = `${opts.from} to ${opts.to || 'today'}`
    } else {
      const period = parsePeriod(opts.period)
      from = period.from
      to = period.to
      label = period.label
    }

    const stats = getStats(db, { from, to })
    const activities = getActivityStats(db, { from, to })
    const projects = getProjectStats(db, { from, to })
    const models = getModelStats(db, { from, to })
    const forecast = calculateForecast(db)
    const burnRate = calculateBurnRate(db, 5)

    if (opts.format === 'json') {
      console.log(JSON.stringify({
        period: label,
        overview: {
          totalCostUsd: stats.totalCostUsd,
          totalTokens: stats.totalTokens,
          sessionCount: stats.sessionCount,
          cacheHitRate: stats.cacheHitRate,
          avgCostPerSession: stats.avgCostPerSession,
          avgTokensPerSession: stats.avgTokensPerSession,
        },
        burnRate: {
          tokensPerMinute: burnRate.tokensPerMinute,
          costPerHour: burnRate.costPerHour,
          costPerDay: burnRate.costPerDay,
        },
        forecast: {
          projectedMonthEndCost: forecast.projectedMonthEndCost,
          projectedMonthEndTokens: forecast.projectedMonthEndTokens,
          trend: forecast.trend,
          confidence: forecast.confidence,
        },
        activities: activities.map((a) => ({
          name: a.name,
          calls: a.calls,
          totalCostUsd: a.totalCostUsd,
          totalTokens: a.totalTokens,
          oneShotRate: a.oneShotRate,
        })),
        projects: (projects as ProjectStats[]).map((p) => ({
          name: p.projectName,
          cost: p.totalCostUsd,
          tokens: p.totalTokens,
          sessions: p.sessionCount,
        })),
        models: (models as ModelStats[]).map((m) => ({
          model: m.model,
          cost: m.totalCostUsd,
          tokens: m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheWriteTokens,
          calls: m.callCount,
          avgCostPerCall: m.avgCostPerCall,
        })),
        dailyBreakdown: stats.dailyBreakdown,
      }, null, 2))
    } else {
      console.log('\n◇ tokenwatch')
      printHeader(`${label.toUpperCase()}`)
      console.log('')
      console.log('  Overview:')
      printRow('Total cost:', formatCost(stats.totalCostUsd))
      printRow('Total tokens:', formatNumber(stats.totalTokens))
      printRow('Sessions:', stats.sessionCount.toString())
      printRow('Cache hit rate:', `${(stats.cacheHitRate * 100).toFixed(1)}%`)
      printRow('Avg cost/session:', formatCost(stats.avgCostPerSession))
      printRow('Avg tokens/session:', formatNumber(stats.avgTokensPerSession))
      console.log('')

      console.log('  Burn Rate:')
      printRow('Tokens/min:', burnRate.tokensPerMinute.toString())
      printRow('Cost/hr:', formatCost(burnRate.costPerHour) + '/hr')
      printRow('Cost/day:', formatCost(burnRate.costPerDay) + '/day')
      console.log('')

      console.log('  Forecast:')
      printRow('Projected month-end:', formatCost(forecast.projectedMonthEndCost))
      printRow('Trend:', `${forecast.trend} (${forecast.confidence})`)
      console.log('')

      if (opts.verbose) {
        console.log('  By Activity:')
        for (const a of activities) {
          const oneShot = a.oneShotRate !== undefined ? ` (${Math.round(a.oneShotRate * 100)}% 1-shot)` : ''
          console.log(`    ${a.name.padEnd(16)} ${formatCost(a.totalCostUsd).padStart(10)} · ${a.calls.toString().padStart(4)} turns · ${formatNumber(a.totalTokens).padStart(6)} tokens${oneShot}`)
        }
        console.log('')

        console.log('  By Project:')
        for (const p of projects as ProjectStats[]) {
          console.log(`    ${p.projectName.padEnd(20)} ${formatCost(p.totalCostUsd).padStart(10)} · ${p.sessionCount.toString().padStart(3)} sessions · ${formatNumber(p.totalTokens).padStart(6)} tokens`)
        }
        console.log('')

        console.log('  By Model:')
        for (const m of models as ModelStats[]) {
          const totalTokens = m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheWriteTokens
          console.log(`    ${m.model.padEnd(28)} ${formatCost(m.totalCostUsd).padStart(10)} · ${m.callCount.toString().padStart(4)} calls · ${formatNumber(totalTokens).padStart(6)} tokens`)
        }
        console.log('')
      }
    }

    db.close()
  })

program
  .command('daily')
  .description('Daily breakdown chart')
  .option('-p, --period <period>', 'Time period', '7d')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const stats = getStats(db, { from: period.from, to: period.to })

    console.log('\n◇ tokenwatch')
    printHeader('DAILY BREAKDOWN')
    console.log('')

    const maxCost = Math.max(...stats.dailyBreakdown.map((d) => (d as DailyStats).totalCostUsd), 0.001)
    const barWidth = 40

    for (const day of stats.dailyBreakdown) {
      const d = day as DailyStats
      const cost = d.totalCostUsd
      const barLen = Math.max(Math.round((cost / maxCost) * barWidth), 1)
      const bar = '█'.repeat(barLen) + '░'.repeat(barWidth - barLen)
      console.log(`  ${d.date.slice(5)}  │${bar}│ ${formatCost(cost)} · ${formatNumber(d.totalTokens)} tokens · ${d.sessionCount} sessions`)
    }

    console.log('')
    db.close()
  })

program
  .command('models')
  .description('Model usage breakdown')
  .option('-p, --period <period>', 'Time period', '7d')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const models = getModelStats(db, { from: period.from, to: period.to })

    console.log('\n◇ tokenwatch')
    printHeader('BY MODEL')
    console.log('')

    for (const m of models as ModelStats[]) {
      const totalTokens = m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheWriteTokens
      console.log(`  ${m.model}`)
      console.log(`    Cost: ${formatCost(m.totalCostUsd)}  ·  Calls: ${m.callCount}  ·  Tokens: ${formatNumber(totalTokens)}`)
      console.log(`    Avg cost/call: ${formatCost(m.avgCostPerCall)}  ·  Input: ${formatNumber(m.totalInputTokens)}  ·  Output: ${formatNumber(m.totalOutputTokens)}`)
      console.log(`    Cache read: ${formatNumber(m.totalCacheReadTokens)}  ·  Cache write: ${formatNumber(m.totalCacheWriteTokens)}`)
      console.log('')
    }

    db.close()
  })

program
  .command('sessions')
  .description('Top sessions by cost')
  .option('-p, --period <period>', 'Time period', '7d')
  .option('-n, --limit <n>', 'Number of sessions', '10')
  .option('--sort <field>', 'Sort by (cost, tokens, duration)', 'cost')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const sessions = getTopSessions(db, {
      from: period.from,
      to: period.to,
      limit: parseInt(opts.limit),
      sortBy: opts.sort as 'cost' | 'tokens' | 'duration',
    })

    console.log('\n◇ tokenwatch')
    printHeader('TOP SESSIONS')
    console.log('')

    for (const s of sessions) {
      const started = new Date(s.startedAt).toLocaleString()
      console.log(`  ${s.projectName} (${s.provider})`)
      console.log(`    Started: ${started}`)
      console.log(`    Cost: ${formatCost(s.totalCostUsd)}  ·  Tokens: ${formatNumber(s.totalTokens)}  ·  Events: ${s.eventCount}`)
      console.log(`    Models: ${s.modelsUsed.join(', ')}  ·  Tools: ${s.toolsUsed.slice(0, 5).join(', ')}${s.toolsUsed.length > 5 ? '...' : ''}`)
      console.log('')
    }

    db.close()
  })

program
  .command('tools')
  .description('Tool and shell command breakdown')
  .option('-p, --period <period>', 'Time period', '7d')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const tools = getToolStats(db, { from: period.from, to: period.to })
    const shellCmds = getShellCommandStats(db, { from: period.from, to: period.to })

    console.log('\n◇ tokenwatch')
    printHeader('CORE TOOLS')
    console.log('')

    for (const t of tools) {
      console.log(`  ${t.name.padEnd(18)} ${formatCost(t.totalCostUsd).padStart(10)} · ${t.calls.toString().padStart(4)} calls · ${formatNumber(t.totalTokens).padStart(6)} tokens`)
    }

    console.log('')
    printHeader('SHELL COMMANDS')
    console.log('')

    for (const c of shellCmds) {
      console.log(`  ${c.command.padEnd(18)} ${formatCost(c.totalCostUsd).padStart(10)} · ${c.calls.toString().padStart(4)} calls`)
    }

    console.log('')
    db.close()
  })

program
  .command('export')
  .description('Export data as CSV or JSON')
  .option('-f, --format <format>', 'Output format (csv or json)', 'csv')
  .option('-p, --period <period>', 'Time period', '7d')
  .option('-o, --output <file>', 'Output file path')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const stats = getStats(db, { from: period.from, to: period.to })

    if (opts.format === 'json') {
      const output = JSON.stringify(stats, null, 2)
      if (opts.output) {
        require('fs').writeFileSync(opts.output, output)
        console.log(`Exported to ${opts.output}`)
      } else {
        console.log(output)
      }
    } else {
      let csv = 'date,tokens,cost,sessions,top_model,top_project\n'
      for (const d of stats.dailyBreakdown) {
        const day = d as DailyStats
        csv += `${day.date},${day.totalTokens},${day.totalCostUsd},${day.sessionCount},${day.topModel},${day.topProject}\n`
      }
      if (opts.output) {
        require('fs').writeFileSync(opts.output, csv)
        console.log(`Exported to ${opts.output}`)
      } else {
        console.log(csv)
      }
    }

    db.close()
  })

program
  .command('compare')
  .description('Side-by-side model comparison')
  .option('-p, --period <period>', 'Time period', '6m')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const comparison = compareModels(db, { from: period.from, to: period.to })

    console.log('\n◇ tokenwatch')
    printHeader('MODEL COMPARISON')
    console.log('')

    console.log('  Performance:')
    console.log(`    ${'Model'.padEnd(28)} ${'1-shot'.padStart(8)} ${'Retry'.padStart(8)} ${'Self-correct'.padStart(12)} ${'Edits'.padStart(8)}`)
    console.log('    ' + '─'.repeat(72))
    for (const m of comparison.models) {
      console.log(`    ${m.model.padEnd(28)} ${(Math.round(m.oneShotRate * 100) + '%').padStart(8)} ${(Math.round(m.retryRate * 100) + '%').padStart(8)} ${(Math.round(m.selfCorrectionRate * 100) + '%').padStart(12)} ${m.editCount.toString().padStart(8)}`)
    }
    console.log('')

    console.log('  Efficiency:')
    console.log(`    ${'Model'.padEnd(28)} ${'Cost/call'.padStart(10)} ${'Cost/edit'.padStart(10)} ${'Output/call'.padStart(12)} ${'Cache%'.padStart(8)}`)
    console.log('    ' + '─'.repeat(72))
    for (const m of comparison.models) {
      console.log(`    ${m.model.padEnd(28)} ${('$' + m.avgCostPerCall.toFixed(4)).padStart(10)} ${('$' + m.avgCostPerEdit.toFixed(4)).padStart(10)} ${Math.round(m.avgOutputTokensPerCall).toString().padStart(12)} ${(Math.round(m.cacheHitRate * 100) + '%').padStart(8)}`)
    }
    console.log('')

    console.log('  Behavior:')
    console.log(`    ${'Model'.padEnd(28)} ${'Delegate'.padStart(8)} ${'Plan'.padStart(8)} ${'Tools/turn'.padStart(10)} ${'Sessions'.padStart(8)}`)
    console.log('    ' + '─'.repeat(72))
    for (const m of comparison.models) {
      console.log(`    ${m.model.padEnd(28)} ${(Math.round(m.delegationRate * 100) + '%').padStart(8)} ${(Math.round(m.planningRate * 100) + '%').padStart(8)} ${m.avgToolsPerTurn.toFixed(2).padStart(10)} ${m.sessionCount.toString().padStart(8)}`)
    }
    console.log('')

    if (comparison.categoryComparison.length > 0) {
      console.log('  One-shot rate by category:')
      for (const cat of comparison.categoryComparison) {
        const modelsStr = cat.models.map((m) => `${m.model}: ${Math.round(m.oneShotRate * 100)}%`).join(', ')
        console.log(`    ${cat.category.padEnd(16)} ${modelsStr}`)
      }
      console.log('')
    }

    db.close()
  })

program
  .command('optimize')
  .description('Find wasted tokens and get optimization suggestions')
  .option('-p, --period <period>', 'Time period', '30d')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const result = analyzeOptimizations(db, { from: period.from, to: period.to })

    console.log('\n◇ tokenwatch')
    printHeader('OPTIMIZE')
    console.log('')
    console.log(`  Health Grade: ${result.healthGrade} - ${result.summary}`)
    console.log(`  Findings: ${result.findings.length}`)
    console.log(`  Wasted tokens: ${formatNumber(result.totalWastedTokens)}`)
    console.log(`  Wasted cost: ${formatCost(result.totalWastedCostUsd)}`)
    console.log('')

    for (const finding of result.findings) {
      const severityBadge = finding.severity === 'critical' ? '🔴' : finding.severity === 'warning' ? '🟡' : '🔵'
      console.log(`  ${severityBadge} ${finding.title}`)
      console.log(`    ${finding.description}`)
      console.log(`    Wasted: ${formatNumber(finding.estimatedTokensWasted)} tokens · ${formatCost(finding.estimatedCostUsd)}`)
      console.log(`    Fix:`)
      console.log(`    ${finding.fix.split('\n').join('\n    ')}`)
      console.log('')
    }

    if (result.findings.length === 0) {
      console.log('  No optimization issues found. Your setup looks good!')
      console.log('')
    }

    db.close()
  })

program
  .command('currency')
  .description('Manage display currency')
  .argument('[action]', 'Action: show, set')
  .argument('[code]', 'Currency code (e.g. USD, EUR, GBP, JPY)')
  .action(async (action, code) => {
    if (!action || action === 'show') {
      const current = getCurrency()
      console.log(`Current currency: ${current}`)
      if (current !== 'USD') {
        const example = await convertUsd(1.00, current)
        console.log(`  $1.00 USD = ${example.toFixed(2)} ${current}`)
      }
    } else if (action === 'set') {
      if (!code) {
        console.error('Error: currency code required. Usage: tokenwatch currency set <CODE>')
        process.exit(1)
      }
      setCurrency(code)
      console.log(`Currency set to ${code.toUpperCase()}`)
    } else {
      console.error(`Unknown action: ${action}. Use 'show' or 'set'.`)
      process.exit(1)
    }
  })

program
  .command('yield')
  .description('Analyze AI session productivity via git commit correlation')
  .option('-p, --period <period>', 'Time period', '30d')
  .option('--project <path>', 'Project path (default: auto-detect)')
  .action(async (opts) => {
    const db = await getDb()
    const period = parsePeriod(opts.period)
    const sessions = getTopSessions(db, {
      from: period.from,
      to: period.to,
      limit: 1000,
      sortBy: 'cost',
    })

    const yieldData = analyzeYield(
      sessions.map((s) => ({
        id: s.id,
        projectPath: s.projectName,
        startedAt: new Date(s.startedAt),
        endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
        totalCostUsd: s.totalCostUsd,
        totalTokens: s.totalTokens,
      })),
      opts.project
    )

    console.log('\n◇ tokenwatch')
    printHeader('YIELD ANALYSIS')
    console.log('')
    printRow('Period:', period.label)
    printRow('Total sessions:', yieldData.sessions.length.toString())
    printRow('Total cost:', formatCost(yieldData.totalCostUsd))
    printRow('Total tokens:', formatNumber(yieldData.totalTokens))
    console.log('')

    console.log('  Status Breakdown:')
    printRow('Productive:', `${yieldData.productive.sessions} sessions · ${formatCost(yieldData.productive.costUsd)} · ${yieldData.productive.commits} commits`)
    printRow('Reverted:', `${yieldData.reverted.sessions} sessions · ${formatCost(yieldData.reverted.costUsd)} · ${yieldData.reverted.commits} commits`)
    printRow('Abandoned:', `${yieldData.abandoned.sessions} sessions · ${formatCost(yieldData.abandoned.costUsd)}`)
    console.log('')

    const total = yieldData.sessions.length || 1
    const productivePct = ((yieldData.productive.sessions / total) * 100).toFixed(1)
    const revertedPct = ((yieldData.reverted.sessions / total) * 100).toFixed(1)
    const abandonedPct = ((yieldData.abandoned.sessions / total) * 100).toFixed(1)
    console.log(`  Productive: ${productivePct}% | Reverted: ${revertedPct}% | Abandoned: ${abandonedPct}%`)
    console.log('')

    const yieldScore = (yieldData.productive.costUsd / (yieldData.totalCostUsd || 1)) * 100
    console.log(`  Yield Score: ${yieldScore.toFixed(1)}% of AI spend is productive`)
    console.log('')

    if (opts.period !== 'all') {
      console.log('  Recent Sessions:')
      const recent = yieldData.sessions.filter((s) => s.status !== 'abandoned').slice(0, 5)
      for (const s of recent) {
        const status = s.status === 'productive' ? '✓' : '✗'
        const project = s.projectPath.split('/').pop() || s.projectPath
        console.log(`    ${status} ${project} · ${formatCost(s.costUsd)} · ${s.commits.length} commit(s)`)
      }
      console.log('')
    }

    db.close()
  })

program
  .command('model-alias')
  .description('Manage model name aliases')
  .argument('[action]', 'Action: list, set, remove')
  .argument('[alias]', 'Alias name')
  .argument('[target]', 'Target model name')
  .action(async (action, alias, target) => {
    if (!action || action === 'list') {
      const aliases = getModelAliases()
      const keys = Object.keys(aliases)
      if (keys.length === 0) {
        console.log('No model aliases configured. Use: tokenwatch model-alias set <alias> <target>')
        return
      }
      console.log('\n◇ tokenwatch')
      printHeader('MODEL ALIASES')
      console.log('')
      for (const a of keys) {
        console.log(`  ${a.padEnd(24)} → ${aliases[a]}`)
      }
      console.log('')
    } else if (action === 'set') {
      if (!alias || !target) {
        console.error('Error: alias and target required. Usage: tokenwatch model-alias set <alias> <target>')
        process.exit(1)
      }
      setModelAlias(alias, target)
      console.log(`Alias set: ${alias} → ${target}`)
    } else if (action === 'remove') {
      if (!alias) {
        console.error('Error: alias required. Usage: tokenwatch model-alias remove <alias>')
        process.exit(1)
      }
      removeModelAlias(alias)
      console.log(`Alias removed: ${alias}`)
    } else {
      console.error(`Unknown action: ${action}. Use 'list', 'set', or 'remove'.`)
      process.exit(1)
    }
  })

program.parse()
