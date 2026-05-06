import { startCollector, Database } from '@tokenwatch/collector'
import { AnalyticsEngine } from '@tokenwatch/engine'
import { ApiServer } from './server'
import { WebSocketManager } from './websocket'

export { ApiServer } from './server'
export { WebSocketManager } from './websocket'
export { LiveBroadcaster } from './live-broadcaster'
export { requireAuth } from './auth'

export async function startApi(options?: {
  port?: number
  authToken?: string
  onReady?: (port: number) => void
}) {
  const { db, watcher } = await startCollector()

  const engine = new AnalyticsEngine(db)
  const wsManager = new WebSocketManager()

  // Wire up collector events to WebSocket
  const originalOnEvent = watcher['onEvent']
  // @ts-ignore
  watcher.onEvent = (event: any) => {
    if (originalOnEvent) originalOnEvent(event)
    wsManager.broadcast({ type: 'token_event', data: event })
  }

  const server = new ApiServer({
    port: options?.port,
    db,
    engine,
    authToken: options?.authToken,
  })

  await server.start()

  const port = options?.port ?? 57821
  options?.onReady?.(port)

  return { server, db, watcher, engine, wsManager }
}
