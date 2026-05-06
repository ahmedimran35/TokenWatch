import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import type { TokenEvent } from '@tokenwatch/types'
import { calculateCost } from '../pricing'
import { getModelAliases } from '../config'

export interface ClineTask {
  id: string
  projectPath: string
  projectName: string
  events: ClineEvent[]
}

export interface ClineEvent {
  id: string
  timestamp: Date
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  toolName: string
  toolInput: string
  toolResult: string
}

function findClineTasks(extensionId: string): string[] {
  const files: string[] = []
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', extensionId, 'tasks'),
    path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', extensionId, 'tasks'),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Code', 'User', 'globalStorage', extensionId, 'tasks') : null,
  ].filter(Boolean) as string[]

  for (const baseDir of candidates) {
    if (!fs.existsSync(baseDir)) continue
    try {
      const tasks = fs.readdirSync(baseDir, { withFileTypes: true })
      for (const task of tasks) {
        if (!task.isDirectory()) continue
        const messagesPath = path.join(baseDir, task.name, 'ui_messages.json')
        if (fs.existsSync(messagesPath)) {
          files.push(messagesPath)
        }
      }
    } catch {
      // ignore
    }
  }

  return files
}

function parseMessages(filePath: string, provider: string): ClineTask | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const messages = JSON.parse(raw)

    const events: ClineEvent[] = []
    const aliases = getModelAliases()

    // Extract project path from file path
    // .../globalStorage/<extensionId>/tasks/<taskId>/ui_messages.json
    const pathParts = filePath.split(path.sep)
    const tasksIndex = pathParts.findIndex((p) => p === 'tasks')
    const taskId = tasksIndex >= 0 ? pathParts[tasksIndex + 1] : ''
    const projectPath = tasksIndex >= 2 ? pathParts.slice(0, tasksIndex - 2).join(path.sep) : ''
    const projectName = path.basename(projectPath) || provider

    for (const msg of messages) {
      if (msg.type !== 'say' || msg.say !== 'api_req_started') continue

      const text = msg.text || ''
      const model = extractModelFromText(text)
      const usage = extractUsageFromText(text)

      // Find the corresponding api_req_finished message
      const finishedMsg = messages.find((m: any) =>
        m.type === 'say' && m.say === 'api_req_finished' && m.ts === msg.ts
      )

      let inputTokens = usage.inputTokens
      let outputTokens = usage.outputTokens
      let cacheReadTokens = usage.cacheReadTokens
      let cacheWriteTokens = usage.cacheWriteTokens

      if (finishedMsg?.text) {
        const finishedUsage = extractUsageFromText(finishedMsg.text)
        inputTokens = finishedUsage.inputTokens || inputTokens
        outputTokens = finishedUsage.outputTokens || outputTokens
        cacheReadTokens = finishedUsage.cacheReadTokens || cacheReadTokens
        cacheWriteTokens = finishedUsage.cacheWriteTokens || cacheWriteTokens
      }

      // Extract tool info from subsequent messages
      let toolName = ''
      let toolInput = ''
      const subsequentMessages = messages.slice(messages.indexOf(msg) + 1, messages.indexOf(msg) + 5)
      for (const sub of subsequentMessages) {
        if (sub.type === 'say' && sub.say === 'tool') {
          toolName = sub.name || sub.text?.split(' ')[0] || ''
          toolInput = sub.text || ''
          break
        }
      }

      events.push({
        id: `${filePath}:${msg.ts}`,
        timestamp: new Date(msg.ts || Date.now()),
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        toolName,
        toolInput,
        toolResult: '',
      })
    }

    return {
      id: taskId,
      projectPath,
      projectName,
      events,
    }
  } catch {
    return null
  }
}

function extractModelFromText(text: string): string {
  const modelMatch = text.match(/model["\s:]+([a-zA-Z0-9._-]+)/i)
  if (modelMatch) return modelMatch[1]
  return 'claude-sonnet-4-6'
}

function extractUsageFromText(text: string): { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } {
  const result = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

  const inputMatch = text.match(/input["\s:]+(\d+)/i)
  const outputMatch = text.match(/output["\s:]+(\d+)/i)
  const cacheReadMatch = text.match(/cache[_\s]?read["\s:]+(\d+)/i)
  const cacheWriteMatch = text.match(/cache[_\s]?(write|creation)["\s:]+(\d+)/i)

  if (inputMatch) result.inputTokens = parseInt(inputMatch[1])
  if (outputMatch) result.outputTokens = parseInt(outputMatch[1])
  if (cacheReadMatch) result.cacheReadTokens = parseInt(cacheReadMatch[1])
  if (cacheWriteMatch) result.cacheWriteTokens = parseInt(cacheWriteMatch[2] || cacheWriteMatch[1])

  return result
}

export function collectRooCodeTasks(): ClineTask[] {
  return collectClineTasks('rooveterinaryinc.roo-cline', 'roo-code')
}

export function collectKiloCodeTasks(): ClineTask[] {
  return collectClineTasks('kilocode.kilo-code', 'kilo-code')
}

function collectClineTasks(extensionId: string, provider: string): ClineTask[] {
  const files = findClineTasks(extensionId)
  const tasks: ClineTask[] = []

  for (const file of files) {
    const task = parseMessages(file, provider)
    if (task && task.events.length > 0) {
      tasks.push(task)
    }
  }

  return tasks
}

export function clineTasksToEvents(tasks: ClineTask[], provider: string): TokenEvent[] {
  const events: TokenEvent[] = []
  const aliases = getModelAliases()

  for (const task of tasks) {
    for (const event of task.events) {
      const costUsd = calculateCost(event.model, event.inputTokens, event.outputTokens, event.cacheReadTokens, event.cacheWriteTokens, aliases)
      events.push({
        id: event.id,
        sessionId: task.id,
        projectPath: task.projectPath,
        projectName: task.projectName,
        provider,
        timestamp: event.timestamp,
        model: event.model,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheWriteTokens: event.cacheWriteTokens,
        totalTokens: event.inputTokens + event.outputTokens + event.cacheReadTokens + event.cacheWriteTokens,
        costUsd,
        toolName: event.toolName || undefined,
        toolInput: event.toolInput || undefined,
        conversationId: task.id,
      })
    }
  }

  return events
}
