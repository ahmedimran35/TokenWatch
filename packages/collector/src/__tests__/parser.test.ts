import { parseLine } from '../parser'

describe('parseLine', () => {
  const filePath = '/Users/test/.claude/projects/-Users-test-code-myapp/session1.jsonl'

  it('parses a valid assistant line', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_123',
        model: 'claude-sonnet-4-6-20251001',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5,
        },
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }],
      },
      timestamp: '2026-05-04T10:30:00.000Z',
      sessionId: 'abc123',
      costUSD: 0.00234,
      durationMs: 1200,
    })

    const event = parseLine(line, filePath)
    expect(event).not.toBeNull()
    expect(event!.sessionId).toBe('abc123')
    expect(event!.model).toBe('claude-sonnet-4-6-20251001')
    expect(event!.inputTokens).toBe(100)
    expect(event!.outputTokens).toBe(50)
    expect(event!.cacheReadTokens).toBe(5)
    expect(event!.cacheWriteTokens).toBe(10)
    expect(event!.totalTokens).toBe(165)
    expect(event!.toolName).toBe('Bash')
    expect(event!.provider).toBe('claude')
  })

  it('returns null for non-assistant type', () => {
    const line = JSON.stringify({ type: 'user', message: {} })
    expect(parseLine(line, filePath)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseLine('not json', filePath)).toBeNull()
  })

  it('returns null for missing message', () => {
    const line = JSON.stringify({ type: 'assistant' })
    expect(parseLine(line, filePath)).toBeNull()
  })

  it('handles missing usage gracefully', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { id: 'msg_1', model: 'claude-sonnet-4-6' },
      timestamp: '2026-05-04T10:30:00.000Z',
    })
    const event = parseLine(line, filePath)
    expect(event).not.toBeNull()
    expect(event!.totalTokens).toBe(0)
  })

  it('derives project path correctly', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { id: 'msg_1', model: 'claude-sonnet-4-6' },
      timestamp: '2026-05-04T10:30:00.000Z',
    })
    const event = parseLine(line, filePath)
    expect(event!.projectName).toBe('myapp')
  })
})
