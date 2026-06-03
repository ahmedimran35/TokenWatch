import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Alert, AlertConfig } from '@tokenwatch/types'
import { sendNotifications, sendSlackNotification, sendWebhookNotification } from '../notifier'

const mockAlert: Alert = {
  id: 'test-alert-1',
  type: 'budget_daily',
  threshold: 10,
  currentValue: 12.5,
  triggeredAt: new Date('2024-01-01T00:00:00Z'),
  acknowledged: false,
  message: 'Daily budget exceeded: $12.5000 / $10',
}

describe('sendNotifications', () => {
  it('sends nothing when config has no webhook urls', async () => {
    const config: AlertConfig = { dailyBudgetUsd: 10 }
    await expect(sendNotifications(config, mockAlert)).resolves.toBeUndefined()
  })

  it('sends to all configured channels', async () => {
    const config: AlertConfig = {
      slackWebhookUrl: 'https://hooks.slack.com/test',
      discordWebhookUrl: 'https://discord.com/api/webhooks/test',
      webhookUrl: 'https://example.com/webhook',
    }
    await expect(sendNotifications(config, mockAlert)).resolves.toBeUndefined()
  })

  it('handles invalid webhook URLs gracefully', async () => {
    const config: AlertConfig = {
      slackWebhookUrl: 'not-a-valid-url',
      webhookUrl: '',
    }
    await expect(sendNotifications(config, mockAlert)).resolves.toBeUndefined()
  })
})

describe('sendSlackNotification', () => {
  it('handles invalid URLs without throwing', async () => {
    await expect(sendSlackNotification('not-a-url', mockAlert)).resolves.toBeUndefined()
  })

  it('handles unreachable servers without throwing', async () => {
    await expect(sendSlackNotification('http://localhost:1', mockAlert)).resolves.toBeUndefined()
  })
})

describe('sendWebhookNotification', () => {
  it('handles invalid URLs without throwing', async () => {
    await expect(sendWebhookNotification('not-a-url', mockAlert)).resolves.toBeUndefined()
  })
})
