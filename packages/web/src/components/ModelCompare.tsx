import { useState } from 'react'

interface ModelMetric {
  model: string
  totalCostUsd: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  callCount: number
  editCount: number
  avgCostPerCall: number
  avgCostPerEdit: number
  avgOutputTokensPerCall: number
  cacheHitRate: number
  oneShotRate: number
  retryRate: number
  selfCorrectionRate: number
  delegationRate: number
  planningRate: number
  avgToolsPerTurn: number
  sessionCount: number
}

interface CategoryComparison {
  category: string
  models: Array<{
    model: string
    calls: number
    oneShotRate: number
    totalCostUsd: number
  }>
}

interface ModelCompareProps {
  models: ModelMetric[]
  categories: CategoryComparison[]
}

type MetricTab = 'performance' | 'efficiency' | 'behavior'

export function ModelCompare({ models, categories }: ModelCompareProps) {
  const [activeTab, setActiveTab] = useState<MetricTab>('performance')
  const [selectedModels, setSelectedModels] = useState<string[]>(
    models.slice(0, 3).map((m) => m.model)
  )

  const filteredModels = models.filter((m) => selectedModels.includes(m.model))
  const maxCost = Math.max(...filteredModels.map((m) => m.totalCostUsd), 0.001)

  const tabs: Array<{ id: MetricTab; label: string; metrics: Array<{ key: keyof ModelMetric; label: string; format: (v: number) => string; best: 'high' | 'low' }> }> = [
    {
      id: 'performance',
      label: 'Performance',
      metrics: [
        { key: 'oneShotRate', label: 'One-shot rate', format: (v) => `${Math.round(v * 100)}%`, best: 'high' },
        { key: 'retryRate', label: 'Retry rate', format: (v) => `${Math.round(v * 100)}%`, best: 'low' },
        { key: 'selfCorrectionRate', label: 'Self-correction', format: (v) => `${Math.round(v * 100)}%`, best: 'high' },
        { key: 'editCount', label: 'Total edits', format: (v) => v.toString(), best: 'high' },
      ],
    },
    {
      id: 'efficiency',
      label: 'Efficiency',
      metrics: [
        { key: 'avgCostPerCall', label: 'Cost/call', format: (v) => `$${v.toFixed(4)}`, best: 'low' },
        { key: 'avgCostPerEdit', label: 'Cost/edit', format: (v) => `$${v.toFixed(4)}`, best: 'low' },
        { key: 'avgOutputTokensPerCall', label: 'Output/call', format: (v) => Math.round(v).toLocaleString(), best: 'high' },
        { key: 'cacheHitRate', label: 'Cache hit', format: (v) => `${Math.round(v * 100)}%`, best: 'high' },
      ],
    },
    {
      id: 'behavior',
      label: 'Behavior',
      metrics: [
        { key: 'delegationRate', label: 'Delegation rate', format: (v) => `${Math.round(v * 100)}%`, best: 'high' },
        { key: 'planningRate', label: 'Planning rate', format: (v) => `${Math.round(v * 100)}%`, best: 'high' },
        { key: 'avgToolsPerTurn', label: 'Tools/turn', format: (v) => v.toFixed(2), best: 'high' },
        { key: 'sessionCount', label: 'Sessions', format: (v) => v.toString(), best: 'high' },
      ],
    },
  ]

  const currentMetrics = tabs.find((t) => t.id === activeTab)!

  function toggleModel(model: string) {
    if (selectedModels.includes(model)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter((m) => m !== model))
      }
    } else {
      setSelectedModels([...selectedModels, model])
    }
  }

  function highlightBest(model: ModelMetric, metricKey: keyof ModelMetric, best: 'high' | 'low'): string {
    const values = filteredModels.map((m) => m[metricKey] as number)
    const bestValue = best === 'high' ? Math.max(...values) : Math.min(...values)
    const currentValue = model[metricKey] as number

    if (currentValue === bestValue && filteredModels.length > 1) {
      return 'text-success font-bold'
    }
    return ''
  }

  const activeCategory = categories.length > 0 ? categories[0] : null

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">MODEL COMPARISON</h3>

      {/* Model selector */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {models.map((m) => (
          <button
            key={m.model}
            onClick={() => toggleModel(m.model)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedModels.includes(m.model)
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-secondary hover:border-secondary'
            }`}
          >
            {m.model}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-border/30 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-accent/20 text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics grid */}
      <div className="space-y-3">
        {currentMetrics.metrics.map((metric) => (
          <div key={metric.key} className="border-t border-border/20 pt-2">
            <div className="text-secondary text-xs mb-1">{metric.label}</div>
            <div className="flex items-center gap-4">
              {filteredModels.map((model) => (
                <div key={model.model} className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-secondary truncate">{model.model}</span>
                    <span className={`font-mono ml-2 ${highlightBest(model, metric.key, metric.best)}`}>
                      {metric.format(model[metric.key] as number)}
                    </span>
                  </div>
                  {metric.key !== 'editCount' && metric.key !== 'sessionCount' && (
                    <div className="h-1.5 bg-border/20 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${metric.best === 'high'
                            ? Math.max(((model[metric.key] as number) / Math.max(...filteredModels.map((m) => m[metric.key] as number), 0.001)) * 100, 5)
                            : Math.max((1 - (model[metric.key] as number) / Math.max(...filteredModels.map((m) => m[metric.key] as number), 0.001)) * 100, 5)
                          }%`,
                          backgroundColor: highlightBest(model, metric.key, metric.best).includes('success')
                            ? '#10b981'
                            : '#3b82f6',
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cost comparison */}
      <div className="border-t border-border/30 mt-3 pt-2">
        <div className="text-secondary text-xs mb-2">Total cost</div>
        {filteredModels.map((model) => (
          <div key={model.model} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-24 truncate text-secondary">{model.model}</div>
            <div className="flex-1 h-2 bg-border/20 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max((model.totalCostUsd / maxCost) * 100, 2)}%`,
                  backgroundColor: '#f59e0b',
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-accent font-mono w-16 text-right">
              ${model.totalCostUsd.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Per-category one-shot rates */}
      {activeCategory && (
        <div className="border-t border-border/30 mt-3 pt-2">
          <div className="text-secondary text-xs mb-2">One-shot rate by category</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {categories.slice(0, 8).map((cat) => (
              <div key={cat.category}>
                <div className="text-secondary mb-1">{cat.category}</div>
                {cat.models
                  .filter((m) => selectedModels.includes(m.model))
                  .map((m) => (
                    <div key={m.model} className="flex items-center justify-between">
                      <span className="text-secondary truncate">{m.model}</span>
                      <span
                        className="font-mono"
                        style={{
                          color: m.oneShotRate >= 0.8 ? '#10b981' : m.oneShotRate >= 0.5 ? '#f59e0b' : '#ef4444',
                        }}
                      >
                        {Math.round(m.oneShotRate * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
