 import { Database } from './database'
 import { CollectorWatcher } from './watcher'
 import type { TokenEvent } from '@tokenwatch/types'
 import { ensurePricingLoaded } from './pricing'
 import { collectCursorSessions, cursorSessionsToEvents } from './providers/cursor'
 import { collectCopilotSessions, copilotSessionsToEvents } from './providers/copilot'
 import { collectRooCodeTasks, collectKiloCodeTasks, clineTasksToEvents } from './providers/cline-family'
 import { logger } from './logger'

 export async function startCollector(options?: {
   onEvent?: (event: TokenEvent) => void
   onError?: (error: Error) => void
 }) {
   const db = new Database()
   await db.init()
   await ensurePricingLoaded()

   // Load Cursor sessions
   const cursorSessions = collectCursorSessions()
   if (cursorSessions.length > 0) {
     logger.info({ count: cursorSessions.length }, 'Loaded Cursor sessions')
     const cursorEvents = cursorSessionsToEvents(cursorSessions)
     for (const event of cursorEvents) {
       db.insertEvent(event)
       if (options?.onEvent) options.onEvent(event)
     }
   }

   // Load Copilot sessions
   const copilotSessions = collectCopilotSessions()
   if (copilotSessions.length > 0) {
     logger.info({ count: copilotSessions.length }, 'Loaded Copilot sessions')
     const copilotEvents = copilotSessionsToEvents(copilotSessions)
     for (const event of copilotEvents) {
       db.insertEvent(event)
       if (options?.onEvent) options.onEvent(event)
     }
   }

   // Load Roo Code tasks
   const rooTasks = collectRooCodeTasks()
   if (rooTasks.length > 0) {
     logger.info({ count: rooTasks.length }, 'Loaded Roo Code tasks')
     const rooEvents = clineTasksToEvents(rooTasks, 'roo-code')
     for (const event of rooEvents) {
       db.insertEvent(event)
       if (options?.onEvent) options.onEvent(event)
     }
   }

   // Load KiloCode tasks
   const kiloTasks = collectKiloCodeTasks()
   if (kiloTasks.length > 0) {
     logger.info({ count: kiloTasks.length }, 'Loaded KiloCode tasks')
     const kiloEvents = clineTasksToEvents(kiloTasks, 'kilo-code')
     for (const event of kiloEvents) {
       db.insertEvent(event)
       if (options?.onEvent) options.onEvent(event)
     }
   }

   const watcher = new CollectorWatcher({ db, onEvent: options?.onEvent })
   await watcher.start()

   process.on('SIGINT', () => { watcher.stop(); db.close(); process.exit(0) })
   process.on('SIGTERM', () => { watcher.stop(); db.close(); process.exit(0) })

   return { db, watcher }
 }

export { Database } from './database'
export { CollectorWatcher } from './watcher'
export { parseLine } from './parser'
export { calculateCost, getPriceForModel, ensurePricingLoaded } from './pricing'
export { Deduplicator } from './deduplicator'
export { loadDailyCache, saveDailyCache, invalidateDailyCache } from './daily-cache'
export {
  getCurrency, setCurrency,
  getModelAliases, setModelAlias, removeModelAlias,
  getPlan, setPlan,
  convertUsd, formatCurrency,
} from './config'
export {
  collectCursorSessions, cursorSessionsToEvents,
} from './providers/cursor'
export {
  collectCopilotSessions, copilotSessionsToEvents,
} from './providers/copilot'
export {
  collectRooCodeTasks, collectKiloCodeTasks, clineTasksToEvents,
} from './providers/cline-family'

