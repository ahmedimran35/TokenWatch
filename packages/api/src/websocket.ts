import * as http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { URL } from 'url'

interface VerifyClientInfo {
  req: IncomingMessage
  origin: string
  secure: boolean
}

export class WebSocketManager {
  private clients: Set<WebSocket> = new Set()
  private pingInterval?: NodeJS.Timeout
  private authToken?: string
  private maxClients: number

  constructor(options?: { authToken?: string; maxClients?: number }) {
    this.authToken = options?.authToken
    this.maxClients = options?.maxClients ?? 10
  }

  attach(server: http.Server): void {
    const wss = new WebSocketServer({
      server,
      verifyClient: (info: VerifyClientInfo) => this.verifyConnection(info),
    })

    wss.on('connection', (ws) => {
      if (this.maxClients > 0 && this.clients.size >= this.maxClients) {
        ws.close(1013, 'Too many connections')
        return
      }

      this.clients.add(ws)
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date() }))

      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
      ws.on('pong', () => {
        ;(ws as any).isAlive = true
      })
    })

    this.pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          ws.terminate()
          return
        }
        ;(ws as any).isAlive = false
        ws.ping()
      })
    }, 30000)
  }

  private verifyConnection(info: VerifyClientInfo): boolean {
    if (!this.authToken) return true

    try {
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`)
      const token = url.searchParams.get('token')
      return token === this.authToken
    } catch {
      return false
    }
  }

  broadcast(event: {
    type: 'token_event' | 'session_update' | 'alert' | 'burn_rate_update'
    data: unknown
  }): void {
    const message = JSON.stringify(event)
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
        } catch {
          // client disconnected or send failed
          this.clients.delete(ws)
        }
      }
    })
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }
    this.clients.forEach((ws) => ws.terminate())
    this.clients.clear()
  }

  getClientCount(): number {
    return this.clients.size
  }
}
