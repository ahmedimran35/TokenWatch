import pino from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LoggerOptions {
  level?: LogLevel
  component?: string
  prettyPrint?: boolean
}

const createLogger = (options: LoggerOptions = {}): pino.Logger => {
  const level = options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  const component = options.component || 'tokenwatch'

  const transports: pino.TransportTargetOptions[] = []

  if (process.env.NODE_ENV === 'production') {
    transports.push({
      target: 'pino/file',
      level,
      options: { destination: 1 },
    })
  }

  return pino({
    level,
    name: component,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { pid: process.pid, hostname: process.env.HOSTNAME || 'localhost' },
    transport: transports.length > 0 ? { targets: transports } : undefined,
  })
}

export const logger = createLogger()

export function createChildLogger(component: string, options?: LoggerOptions): pino.Logger {
  return createLogger({ ...options, component })
}

export default logger
