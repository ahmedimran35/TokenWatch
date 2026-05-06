import * as childProcess from 'child_process'
import * as path from 'path'

const GIT_HASH_RE = /^[a-f0-9]{40}$/

function validateGitHash(hash: string): boolean {
  return GIT_HASH_RE.test(hash)
}

function validateProjectPath(p: string): string {
  const resolved = path.resolve(p)
  if (!path.isAbsolute(resolved)) throw new Error('Project path must be absolute')
  return resolved
}

export interface YieldResult {
  totalCostUsd: number
  totalTokens: number
  productive: { sessions: number; costUsd: number; tokens: number; commits: number }
  reverted: { sessions: number; costUsd: number; tokens: number; commits: number }
  abandoned: { sessions: number; costUsd: number; tokens: number }
  sessions: YieldSession[]
}

export interface YieldSession {
  sessionId: string
  projectPath: string
  startTime: Date
  endTime: Date
  costUsd: number
  tokens: number
  status: 'productive' | 'reverted' | 'abandoned'
  commits: string[]
}

interface GitCommit {
  hash: string
  timestamp: Date
  subject: string
}

function getGitCommits(projectPath: string, from: Date, to: Date): GitCommit[] {
  try {
    const validatedPath = validateProjectPath(projectPath)
    const result = childProcess.execFileSync(
      'git',
      [
        'log',
        '--format=%H|%ai|%s',
        `--after=${from.toISOString()}`,
        `--before=${to.toISOString()}`,
      ],
      { cwd: validatedPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )

    return result
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [hash, dateStr, ...subjectParts] = line.split('|')
        return {
          hash: hash?.trim() || '',
          timestamp: new Date(dateStr?.trim() || ''),
          subject: subjectParts.join('|').trim(),
        }
      })
      .filter((c) => !isNaN(c.timestamp.getTime()))
  } catch {
    return []
  }
}

function getRevertedCommits(projectPath: string, commits: GitCommit[]): Set<string> {
  const reverted = new Set<string>()
  try {
    const validatedPath = validateProjectPath(projectPath)
    const result = childProcess.execFileSync(
      'git',
      ['log', '--grep=revert', '--format=%H', '--all'],
      { cwd: validatedPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )

    for (const line of result.trim().split('\n').filter((l) => l.trim())) {
      const hash = line.trim()
      if (!validateGitHash(hash)) continue
      // Find the original commit that was reverted
      const revertResult = childProcess.execFileSync(
        'git',
        ['log', '--format=%H', '-1', '--merges', hash],
        { cwd: validatedPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      const mergeHash = revertResult.trim()
      if (mergeHash && validateGitHash(mergeHash)) {
        reverted.add(mergeHash)
      }
    }
  } catch {
    // ignore
  }
  return reverted
}

function checkIfMerged(projectPath: string, commitHash: string): boolean {
  if (!validateGitHash(commitHash)) return false
  try {
    const validatedPath = validateProjectPath(projectPath)
    const result = childProcess.execFileSync(
      'git',
      ['branch', '-r', '--contains', commitHash],
      { cwd: validatedPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return result.trim().length > 0
  } catch {
    return false
  }
}

export function analyzeYield(
  sessions: Array<{
    id: string
    projectPath: string
    startedAt: Date
    endedAt?: Date
    totalCostUsd: number
    totalTokens: number
  }>,
  projectPath?: string
): YieldResult {
  const targetPath = projectPath || sessions[0]?.projectPath || '.'

  const commits = getGitCommits(targetPath, new Date(0), new Date())
  const revertedHashes = getRevertedCommits(targetPath, commits)

  const result: YieldResult = {
    totalCostUsd: 0,
    totalTokens: 0,
    productive: { sessions: 0, costUsd: 0, tokens: 0, commits: 0 },
    reverted: { sessions: 0, costUsd: 0, tokens: 0, commits: 0 },
    abandoned: { sessions: 0, costUsd: 0, tokens: 0 },
    sessions: [],
  }

  const TIME_WINDOW_MS = 30 * 60 * 1000 // 30 minute window around session

  for (const session of sessions) {
    const sessionEnd = session.endedAt || session.startedAt
    const windowStart = new Date(session.startedAt.getTime() - TIME_WINDOW_MS)
    const windowEnd = new Date(sessionEnd.getTime() + TIME_WINDOW_MS)

    const sessionCommits = commits.filter(
      (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd
    )

    let status: 'productive' | 'reverted' | 'abandoned' = 'abandoned'
    const commitHashes: string[] = []

    if (sessionCommits.length > 0) {
      const revertedCount = sessionCommits.filter((c) => revertedHashes.has(c.hash)).length
      const mergedCount = sessionCommits.filter((c) => !revertedHashes.has(c.hash) && checkIfMerged(targetPath, c.hash)).length

      commitHashes.push(...sessionCommits.map((c) => c.hash))

      if (revertedCount > 0 && mergedCount === 0) {
        status = 'reverted'
      } else if (mergedCount > 0) {
        status = 'productive'
      } else if (revertedCount > 0) {
        status = 'reverted'
      }
    }

    const sessionResult: YieldSession = {
      sessionId: session.id,
      projectPath: session.projectPath,
      startTime: session.startedAt,
      endTime: sessionEnd,
      costUsd: session.totalCostUsd,
      tokens: session.totalTokens,
      status,
      commits: commitHashes,
    }

    result.sessions.push(sessionResult)
    result.totalCostUsd += session.totalCostUsd
    result.totalTokens += session.totalTokens

    if (status === 'productive') {
      result.productive.sessions++
      result.productive.costUsd += session.totalCostUsd
      result.productive.tokens += session.totalTokens
      result.productive.commits += commitHashes.length
    } else if (status === 'reverted') {
      result.reverted.sessions++
      result.reverted.costUsd += session.totalCostUsd
      result.reverted.tokens += session.totalTokens
      result.reverted.commits += commitHashes.length
    } else {
      result.abandoned.sessions++
      result.abandoned.costUsd += session.totalCostUsd
      result.abandoned.tokens += session.totalTokens
    }
  }

  return result
}
