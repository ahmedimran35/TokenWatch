import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import type { TokenEvent } from '@tokenwatch/types'
import { calculateCost } from '../pricing'
import { getModelAliases } from '../config'

export interface CopilotTranscript {
  sessionId: string
  projectPath: string
  projectName: string
  events: CopilotEvent[]
}

export interface CopilotEvent {
  id: string
  timestamp: Date
  model: string
  inputTokens: number
  outputTokens: number
  toolName: string
  toolInput: string
}

function findCopilotTranscripts(): string[] {
  const files: string[] = []
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
    path.join(os.homedir(), '.config', 'Code', 'User', 'workspaceStorage'),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Code', 'User', 'workspaceStorage') : null,
  ].filter(Boolean) as string[]

  for (const baseDir of candidates) {
    if (!fs.existsSync(baseDir)) continue
    try {
      const workspaces = fs.readdirSync(baseDir, { withFileTypes: true })
      for (const ws of workspaces) {
        if (!ws.isDirectory()) continue
        const transcriptPath = path.join(baseDir, ws.name, 'GitHub.copilot-chat', 'transcripts')
        if (fs.existsSync(transcriptPath)) {
          const transcripts = fs.readdirSync(transcriptPath)
          for (const t of transcripts) {
            if (t.endsWith('.json')) {
              files.push(path.join(transcriptPath, t))
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return files
}

function parseTranscript(filePath: string): CopilotTranscript | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)

    const events: CopilotEvent[] = []
    const aliases = getModelAliases()

    for (const entry of data.entries || data.messages || []) {
      if (!entry.role || entry.role !== 'assistant') continue

      const model = extractModel(entry)
      const usage = entry.usage || {}
      const inputTokens = usage.prompt_tokens || usage.input_tokens || estimateTokens(entry.content || '')
      const outputTokens = usage.completion_tokens || usage.output_tokens || estimateTokens(entry.content || '')

      let toolName = ''
      let toolInput = ''
      if (entry.tool_calls) {
        const tc = entry.tool_calls[0]
        toolName = tc.function?.name || tc.type || ''
        toolInput = tc.function?.arguments || ''
      }

      events.push({
        id: entry.id || `${filePath}:${entry.timestamp}`,
        timestamp: new Date(entry.timestamp || entry.created_at || Date.now()),
        model,
        inputTokens,
        outputTokens,
        toolName,
        toolInput,
      })
    }

    // Extract project info from file path
    const pathParts = filePath.split(path.sep)
    const wsIndex = pathParts.findIndex((p) => p === 'workspaceStorage')
    const projectPath = wsIndex >= 0 ? pathParts.slice(0, wsIndex).join(path.sep) : ''
    const projectName = path.basename(projectPath) || 'copilot'

    return {
      sessionId: data.sessionId || filePath,
      projectPath,
      projectName,
      events,
    }
  } catch {
    return null
  }
}

function extractModel(entry: any): string {
  if (entry.model) return entry.model
  if (entry.metadata?.model) return entry.metadata.model
  // Infer from tool call ID prefix
  if (entry.tool_calls?.[0]?.id) {
    const id = entry.tool_calls[0].id
    if (id.startsWith('gpt-4o')) return 'gpt-4o'
    if (id.startsWith('gpt-4')) return 'gpt-4'
    if (id.startsWith('gpt-3.5')) return 'gpt-3.5-turbo'
  }
  return 'gpt-4o'
}

function estimateTokens(text: string | any): number {
  if (typeof text === 'string') {
    return Math.ceil(text.length / 4)
  }
  return Math.ceil(JSON.stringify(text).length / 4)
}

export function collectCopilotSessions(): CopilotTranscript[] {
  const files = findCopilotTranscripts()
  const transcripts: CopilotTranscript[] = []

  for (const file of files) {
    const transcript = parseTranscript(file)
    if (transcript && transcript.events.length > 0) {
      transcripts.push(transcript)
    }
  }

  return transcripts
}

export function copilotSessionsToEvents(sessions: CopilotTranscript[]): TokenEvent[] {
  const events: TokenEvent[] = []
  const aliases = getModelAliases()

  for (const session of sessions) {
    for (const event of session.events) {
      const costUsd = calculateCost(event.model, event.inputTokens, event.outputTokens, 0, 0, aliases)
      events.push({
        id: event.id,
        sessionId: session.sessionId,
        projectPath: session.projectPath,
        projectName: session.projectName,
        provider: 'github-copilot',
        timestamp: event.timestamp,
        model: event.model,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: event.inputTokens + event.outputTokens,
        costUsd,
        toolName: event.toolName || undefined,
        toolInput: event.toolInput || undefined,
        conversationId: session.sessionId,
      })
    }
  }

  return events
}
