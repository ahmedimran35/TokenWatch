import { AnalyticsEngine } from '@tokenwatch/engine'
import { WebSocketManager } from './websocket'

export class LiveBroadcaster {
  private burnRateInterval?: NodeJS.Timeout
  private alertInterval?: NodeJS.Timeout
  private statsInterval?: NodeJS.Timeout

  constructor(private engine: AnalyticsEngine, private ws: WebSocketManager) {}

  start(): void {
    this.burnRateInterval = setInterval(() => {
      const burnRate = this.engine.getBurnRate()
      this.ws.broadcast({ type: 'burn_rate_update', data: burnRate })
    }, 5000)

    this.statsInterval = setInterval(() => {
      const liveStats = this.engine.getLiveStats()
      this.ws.broadcast({ type: 'session_update', data: {
        todayCost: liveStats.todayCost,
        todayTokens: liveStats.todayTokens,
        monthCost: liveStats.monthCost,
        monthTokens: liveStats.monthTokens,
        activeSession: liveStats.activeSession,
        burnRate: liveStats.burnRate,
      }})
    }, 10000)

    this.alertInterval = setInterval(() => {
      const newAlerts = this.engine.evaluateAlerts()
      newAlerts.forEach((alert) => {
        this.ws.broadcast({ type: 'alert', data: alert })
      })
    }, 30000)
  }

  stop(): void {
    if (this.burnRateInterval) clearInterval(this.burnRateInterval)
    if (this.alertInterval) clearInterval(this.alertInterval)
    if (this.statsInterval) clearInterval(this.statsInterval)
  }
}
