import { useState } from 'react'
import { format } from 'date-fns'
import type { Alert, AlertConfig } from '@tokenwatch/types'

interface AlertsPanelProps {
  alerts: Alert[]
  config?: AlertConfig
  onAcknowledge?: (id: string) => void
  onSaveConfig?: (config: AlertConfig) => void
  onClose?: () => void
}

export function AlertsPanel({ alerts, config, onAcknowledge, onSaveConfig, onClose }: AlertsPanelProps) {
  const [dailyBudget, setDailyBudget] = useState(config?.dailyBudgetUsd ?? 10)
  const [hourlyBudget, setHourlyBudget] = useState(config?.hourlyBudgetUsd ?? 2)
  const [spikeMultiplier, setSpikeMultiplier] = useState(config?.burnRateSpikeMultiplier ?? 3)
  const [sessionBudget, setSessionBudget] = useState(config?.sessionBudgetUsd ?? 1)
  const [slackUrl, setSlackUrl] = useState(config?.slackWebhookUrl ?? '')
  const [discordUrl, setDiscordUrl] = useState(config?.discordWebhookUrl ?? '')
  const [webhookUrl, setWebhookUrl] = useState(config?.webhookUrl ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSaveConfig?.({
      dailyBudgetUsd: dailyBudget,
      hourlyBudgetUsd: hourlyBudget,
      burnRateSpikeMultiplier: spikeMultiplier,
      sessionBudgetUsd: sessionBudget,
      slackWebhookUrl: slackUrl || undefined,
      discordWebhookUrl: discordUrl || undefined,
      webhookUrl: webhookUrl || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">ALERTS & NOTIFICATIONS</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">✕</button>
        </div>

        {alerts.length === 0 ? (
          <p className="text-secondary text-center py-8">No active alerts</p>
        ) : (
          <div className="space-y-3 mb-6">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-danger/10 border border-danger/30 p-3 rounded">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-danger text-sm font-medium">{(alert.type || 'unknown').replaceAll('_', ' ')}</div>
                    <div className="text-secondary text-xs mt-1">{alert.message}</div>
                    <div className="text-secondary text-xs mt-1">
                      {format(new Date(alert.triggeredAt), 'MMM d, HH:mm')}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAcknowledge?.(alert.id)}
                      className="text-xs bg-danger/20 hover:bg-danger/30 px-2 py-1 rounded text-danger"
                    >
                      ACK
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-4">
          <div>
            <h3 className="text-secondary text-sm mb-3">BUDGET SETTINGS</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secondary block mb-1">Daily Budget ($)</label>
                <input type="number" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} className="w-full bg-background border border-border px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Hourly Budget ($)</label>
                <input type="number" value={hourlyBudget} onChange={(e) => setHourlyBudget(Number(e.target.value))} className="w-full bg-background border border-border px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Session Budget ($)</label>
                <input type="number" value={sessionBudget} onChange={(e) => setSessionBudget(Number(e.target.value))} className="w-full bg-background border border-border px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Burn Rate Spike (×)</label>
                <input type="number" value={spikeMultiplier} onChange={(e) => setSpikeMultiplier(Number(e.target.value))} className="w-full bg-background border border-border px-3 py-2 font-mono text-sm" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-secondary text-sm mb-3">NOTIFICATION CHANNELS</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-secondary block mb-1">Slack Webhook URL</label>
                <input type="url" value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="w-full bg-background border border-border px-3 py-2 font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Discord Webhook URL</label>
                <input type="url" value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-background border border-border px-3 py-2 font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Generic Webhook URL</label>
                <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full bg-background border border-border px-3 py-2 font-mono text-xs" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            className={`w-full font-medium py-2 rounded mt-2 ${saved ? 'bg-green-600 text-white' : 'bg-accent hover:bg-accent/80 text-black'}`}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
