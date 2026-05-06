import pino from 'pino'

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

export const logger = pino({
  level,
  name: 'api',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { pid: process.pid, hostname: process.env.HOSTNAME || 'localhost' },
  transport:
    process.env.NODE_ENV === 'production'
      ? { targets: [{ target: 'pino/file', level, options: { destination: 1 } }] }
      : undefined,
})

export default logger
