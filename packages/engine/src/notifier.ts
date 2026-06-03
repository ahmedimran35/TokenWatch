import * as https from 'https'
import * as http from 'http'
import type { Alert, AlertConfig } from '@tokenwatch/types'

interface NotificationPayload {
  text: string
  attachments?: Array<{
    fallback: string
    color: string
    title: string
    text: string
    fields: Array<{ title: string; value: string; short: boolean }>
    ts: number
  }>
}

function postJson(url: string, payload: NotificationPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url)
      const client = parsed.protocol === 'https:' ? https : http
      const body = JSON.stringify(payload)
      const req = client.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve()
            } else {
              resolve()
            }
          })
        }
      )
      req.on('error', () => resolve())
      req.write(body)
      req.end()
    } catch {
      resolve()
    }
  })
}

function alertToPayload(alert: Alert): NotificationPayload {
  const severityColor = alert.type === 'budget_daily' ? 'danger' : alert.type === 'burn_rate_spike' ? 'warning' : 'good'
  return {
    text: `TokenWatch Alert: ${alert.type.replace(/_/g, ' ')}`,
    attachments: [
      {
        fallback: alert.message,
        color: severityColor,
        title: alert.type.replace(/_/g, ' ').toUpperCase(),
        text: alert.message,
        fields: [
          { title: 'Threshold', value: `$${alert.threshold.toFixed(4)}`, short: true },
          { title: 'Current', value: `$${alert.currentValue.toFixed(4)}`, short: true },
        ],
        ts: Math.floor(new Date(alert.triggeredAt).getTime() / 1000),
      },
    ],
  }
}

export async function sendSlackNotification(webhookUrl: string, alert: Alert): Promise<void> {
  const payload = alertToPayload(alert)
  await postJson(webhookUrl, payload)
}

export async function sendDiscordNotification(webhookUrl: string, alert: Alert): Promise<void> {
  const payload = alertToPayload(alert)
  await postJson(webhookUrl, payload)
}

export async function sendWebhookNotification(webhookUrl: string, alert: Alert): Promise<void> {
  await postJson(webhookUrl, {
    text: alert.message,
    attachments: [
      {
        fallback: alert.message,
        color: '#f59e0b',
        title: `TokenWatch Alert: ${alert.type}`,
        text: alert.message,
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Threshold', value: String(alert.threshold), short: true },
          { title: 'Current Value', value: String(alert.currentValue), short: true },
          { title: 'Time', value: new Date(alert.triggeredAt).toISOString(), short: true },
        ],
        ts: Math.floor(new Date(alert.triggeredAt).getTime() / 1000),
      },
    ],
  })
}

export async function sendNotifications(config: AlertConfig, alert: Alert): Promise<void> {
  const promises: Promise<void>[] = []

  if (config.slackWebhookUrl) {
    promises.push(sendSlackNotification(config.slackWebhookUrl, alert))
  }

  if (config.webhookUrl) {
    promises.push(sendWebhookNotification(config.webhookUrl, alert))
  }

  if (config.discordWebhookUrl) {
    promises.push(sendDiscordNotification(config.discordWebhookUrl, alert))
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises)
  }
}
