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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">ALERTS</h2>
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
                    <div className="text-danger text-sm font-medium">{(alert.type || 'unknown').replace('_', ' ')}</div>
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

        <div className="border-t border-border pt-4">
          <h3 className="text-secondary text-sm mb-3">BUDGET SETTINGS</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-secondary block mb-1">Daily Budget ($)</label>
              <input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-secondary block mb-1">Hourly Budget ($)</label>
              <input
                type="number"
                value={hourlyBudget}
                onChange={(e) => setHourlyBudget(Number(e.target.value))}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-secondary block mb-1">Burn Rate Spike (×)</label>
              <input
                type="number"
                value={spikeMultiplier}
                onChange={(e) => setSpikeMultiplier(Number(e.target.value))}
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm"
              />
            </div>
            <button
              onClick={() => onSaveConfig?.({ dailyBudgetUsd: dailyBudget, hourlyBudgetUsd: hourlyBudget, burnRateSpikeMultiplier: spikeMultiplier })}
              className="w-full bg-accent hover:bg-accent/80 text-black font-medium py-2 rounded mt-2"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}