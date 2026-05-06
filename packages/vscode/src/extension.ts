import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.command = 'tokenwatch.openDashboard'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  async function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('tokenwatch')
    const apiUrl = config.get<string>('apiUrl', 'http://localhost:57821')
    const showCost = config.get<boolean>('showCost', true)

    try {
      const response = await fetch(`${apiUrl}/api/stats/live`, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) throw new Error('API error')

      const stats = await response.json() as any
      const tokensPerMin = Math.round(stats.burnRate?.tokensPerMinute ?? 0)
      const costToday = stats.todayCost?.toFixed(4) ?? '0.0000'
      const hasAlerts = (stats.alerts?.length ?? 0) > 0

      let color = new vscode.ThemeColor('statusBar.foreground')
      if (stats.burnRate?.tokensPerHour > 100000) {
        color = new vscode.ThemeColor('statusBarItem.warningForeground')
      }
      if (hasAlerts) {
        color = new vscode.ThemeColor('statusBarItem.errorForeground')
      }

      const alertIndicator = hasAlerts ? ' ⚠' : ''

      if (showCost) {
        statusBarItem.text = `$(flame) ${tokensPerMin} t/min · $${costToday}${alertIndicator}`
      } else {
        statusBarItem.text = `$(flame) ${tokensPerMin} tokens/min${alertIndicator}`
      }

      statusBarItem.tooltip = [
        `tokenwatch — Live Token Usage`,
        ``,
        `Burn rate: ${tokensPerMin} tokens/min`,
        `Cost rate: $${stats.burnRate?.costPerHour?.toFixed(4) ?? '0.0000'}/hr`,
        `Today: ${stats.todayTokens?.toLocaleString() ?? 0} tokens · $${costToday}`,
        `Month: $${stats.monthCost?.toFixed(4) ?? '0.0000'}`,
        hasAlerts ? `⚠ ${stats.alerts.length} alert(s) active` : `No active alerts`,
        ``,
        `Click to open dashboard`,
      ].join('\n')

      statusBarItem.color = color
    } catch {
      statusBarItem.text = `$(flame) tokenwatch: offline`
      statusBarItem.tooltip = 'tokenwatch API is not running. Start it with: tokenwatch api'
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground')
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('tokenwatch.openDashboard', () => {
      const config = vscode.workspace.getConfiguration('tokenwatch')
      const apiUrl = config.get<string>('apiUrl', 'http://localhost:57821')
      const dashUrl = apiUrl.replace('57821', '57822')
      vscode.env.openExternal(vscode.Uri.parse(dashUrl))
    })
  )

  updateStatusBar()
  const interval = setInterval(() => {
    const config = vscode.workspace.getConfiguration('tokenwatch')
    const refreshSecs = config.get<number>('refreshIntervalSeconds', 10)
    updateStatusBar()
    clearInterval(interval)
    setInterval(updateStatusBar, refreshSecs * 1000)
  }, 0)

  context.subscriptions.push({ dispose: () => clearInterval(interval) })
}

export function deactivate() {}