"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEngine = void 0;
const burn_rate_1 = require("./burn-rate");
const aggregator_1 = require("./aggregator");
const session_ranker_1 = require("./session-ranker");
const alert_evaluator_1 = require("./alert-evaluator");
class AnalyticsEngine {
    db;
    constructor(db) {
        this.db = db;
    }
    getLiveStats() {
        const today = (0, aggregator_1.getToday)(this.db);
        const month = (0, aggregator_1.getThisMonth)(this.db);
        const burnRate = (0, burn_rate_1.calculateBurnRate)(this.db, 5);
        // Get recent events
        const recentEvents = this.db
            .getDatabase()
            .prepare(`SELECT * FROM token_events ORDER BY timestamp DESC LIMIT 20`)
            .all();
        // Get active session (most recent without end)
        const activeSessionRow = this.db
            .getDatabase()
            .prepare(`SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`)
            .get();
        // Get alerts
        const alertRows = this.db
            .getDatabase()
            .prepare(`SELECT * FROM alert_events WHERE acknowledged = 0 ORDER BY triggered_at DESC LIMIT 10`)
            .all();
        return {
            burnRate,
            todayCost: today.totalCostUsd,
            todayTokens: today.totalTokens,
            monthCost: month.totalCostUsd,
            monthTokens: month.totalTokens,
            activeSession: activeSessionRow ? rowToSession(activeSessionRow) : undefined,
            recentEvents: recentEvents.map(rowToTokenEvent),
            alerts: alertRows.map(rowToAlert),
        };
    }
    getStats = aggregator_1.getToday;
    getProjectStats = require('./project-stats').getProjectStats;
    getModelStats = require('./model-stats').getModelStats;
    getTopSessions = session_ranker_1.getTopSessions;
    getSessionTimeline = require('./session-ranker').getSessionTimeline;
    getCacheStats = require('./cache-stats').getCacheStats;
    getBurnRateHistory = require('./burn-rate').getBurnRateHistory;
    evaluateAlerts() {
        const config = (0, alert_evaluator_1.loadAlertConfig)();
        return (0, alert_evaluator_1.evaluateAlerts)(this.db, config);
    }
    getBurnRate(windowMinutes) {
        return (0, burn_rate_1.calculateBurnRate)(this.db, windowMinutes);
    }
}
exports.AnalyticsEngine = AnalyticsEngine;
function rowToTokenEvent(r) {
    return {
        id: r.id,
        sessionId: r.session_id,
        projectPath: r.project_path,
        projectName: r.project_name,
        timestamp: new Date(r.timestamp),
        model: r.model,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheWriteTokens: r.cache_write_tokens,
        totalTokens: r.total_tokens,
        costUsd: r.cost_usd,
        toolName: r.tool_name,
        toolInput: r.tool_input,
        durationMs: r.duration_ms,
        provider: r.provider,
    };
}
function rowToSession(r) {
    return {
        id: r.id,
        projectPath: r.project_path,
        projectName: r.project_name,
        provider: r.provider,
        startedAt: new Date(r.started_at),
        endedAt: r.ended_at ? new Date(r.ended_at) : undefined,
        totalInputTokens: r.total_input_tokens,
        totalOutputTokens: r.total_output_tokens,
        totalCacheReadTokens: r.total_cache_read_tokens,
        totalCacheWriteTokens: r.total_cache_write_tokens,
        totalTokens: r.total_tokens,
        totalCostUsd: r.total_cost_usd,
        eventCount: r.event_count,
        modelsUsed: JSON.parse(r.models_used),
        toolsUsed: JSON.parse(r.tools_used),
    };
}
function rowToAlert(r) {
    return {
        id: r.id,
        type: r.type,
        threshold: r.threshold,
        currentValue: r.current_value,
        triggeredAt: new Date(r.triggered_at),
        acknowledged: !!r.acknowledged,
        message: r.message,
    };
}
__exportStar(require("./burn-rate"), exports);
__exportStar(require("./aggregator"), exports);
__exportStar(require("./project-stats"), exports);
__exportStar(require("./model-stats"), exports);
__exportStar(require("./session-ranker"), exports);
__exportStar(require("./alert-evaluator"), exports);
__exportStar(require("./cache-stats"), exports);
//# sourceMappingURL=index.js.map