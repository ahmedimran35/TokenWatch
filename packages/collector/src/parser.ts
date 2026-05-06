import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import * as os from 'os'
import { calculateCost } from './pricing'
import { getModelAliases } from './config'
import type { TokenEvent } from '@tokenwatch/types'

const contentBlockSchema = z.object({
  type: z.string(),
  name: z.string().optional(),
  input: z.unknown().optional(),
})

const usageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
})

const messageSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  usage: usageSchema.optional(),
  content: z.array(contentBlockSchema).optional(),
})

const lineSchema = z.object({
  type: z.string(),
  message: messageSchema.optional(),
  timestamp: z.string().optional(),
  sessionId: z.string().optional(),
  costUSD: z.number().optional(),
  durationMs: z.number().optional(),
})

export function parseLine(line: string, filePath: string): TokenEvent | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }

  const result = lineSchema.safeParse(parsed)
  if (!result.success) {
    return null
  }

  const data = result.data

  if (data.type !== 'assistant') {
    return null
  }

  const message = data.message
  if (!message) {
    return null
  }

  const rawMessageId = message.id ?? uuidv4()
  const model = message.model ?? 'unknown'
  const usage = message.usage ?? {}
  const inputTokens = usage.input_tokens ?? 0
  const outputTokens = usage.output_tokens ?? 0
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens

  // Extract tool info
  let toolName: string | undefined
  let toolInput: string | undefined
  if (message.content && message.content.length > 0) {
    const toolBlock = message.content.find((b) => b.type === 'tool_use')
    if (toolBlock) {
      toolName = toolBlock.name
      toolInput = JSON.stringify(toolBlock.input)
    }
  }

  // Derive project path from file path
  const homeDir = os.homedir()
  const claudeProjectsDir = path.join(homeDir, '.claude', 'projects')
  const relativePath = path.relative(claudeProjectsDir, filePath)
  const pathParts = relativePath.split(path.sep)
  const encodedProjectPath = pathParts[0] ?? 'unknown'
  const projectPath = decodeProjectPath(encodedProjectPath)
  const projectName = path.basename(projectPath) || encodedProjectPath

  const aliases = getModelAliases()
  const costUsd = data.costUSD ?? calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, aliases)

  return {
    id: uuidv4(),
    sessionId: data.sessionId ?? pathParts[pathParts.length - 1]?.replace('.jsonl', '') ?? uuidv4(),
    projectPath,
    projectName,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costUsd,
    toolName,
    toolInput,
    durationMs: data.durationMs,
    provider: 'claude',
    rawMessageId,
  }
}

function decodeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/')
}
