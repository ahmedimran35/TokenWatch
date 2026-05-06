export interface ParsedLine {
  type: string
  message?: {
    id?: string
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    content?: Array<{
      type: string
      name?: string
      input?: unknown
    }>
  }
  timestamp?: string
  sessionId?: string
  costUSD?: number
  durationMs?: number
}
