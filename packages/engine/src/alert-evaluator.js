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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAlerts = evaluateAlerts;
exports.loadAlertConfig = loadAlertConfig;
exports.saveAlertConfig = saveAlertConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function evaluateAlerts(db, config) {
    const internalDb = db.getDatabase();
    const alerts = [];
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    // Check daily budget
    if (config.dailyBudgetUsd !== undefined) {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const todayCost = internalDb
            .prepare("SELECT COALESCE(SUM(cost_usd), 0) as cost FROM token_events WHERE timestamp >= ?")
            .get(todayStart).cost;
        if (todayCost >= config.dailyBudgetUsd && !recentAlertExists(internalDb, 'budget_daily', thirtyMinAgo)) {
            alerts.push({
                id: `budget_daily-${now.getTime()}`,
                type: 'budget_daily',
                threshold: config.dailyBudgetUsd,
                currentValue: todayCost,
                triggeredAt: now,
                acknowledged: false,
                message: `Daily budget exceeded: $${todayCost.toFixed(4)} / $${config.dailyBudgetUsd}`,
            });
        }
    }
    // Check hourly budget
    if (config.hourlyBudgetUsd !== undefined) {
        const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const hourCost = internalDb
            .prepare("SELECT COALESCE(SUM(cost_usd), 0) as cost FROM token_events WHERE timestamp >= ?")
            .get(hourStart).cost;
        if (hourCost >= config.hourlyBudgetUsd && !recentAlertExists(internalDb, 'budget_hourly', thirtyMinAgo)) {
            alerts.push({
                id: `budget_hourly-${now.getTime()}`,
                type: 'budget_hourly',
                threshold: config.hourlyBudgetUsd,
                currentValue: hourCost,
                triggeredAt: now,
                acknowledged: false,
                message: `Hourly budget exceeded: $${hourCost.toFixed(4)} / $${config.hourlyBudgetUsd}`,
            });
        }
    }
    // Check burn rate spike
    if (config.burnRateSpikeMultiplier !== undefined) {
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const currentBurn = internalDb
            .prepare("SELECT COALESCE(SUM(total_tokens), 0) as tokens FROM token_events WHERE timestamp >= ?")
            .get(fiveMinAgo).tokens;
        const avgBurn = internalDb
            .prepare(`SELECT COALESCE(AVG(tokens), 0) as avg FROM (
          SELECT SUM(total_tokens) as tokens FROM token_events
          WHERE timestamp >= ?
          GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
        )`)
            .get(sevenDaysAgo).avg;
        if (avgBurn > 0 && currentBurn > avgBurn * config.burnRateSpikeMultiplier &&
            !recentAlertExists(internalDb, 'burn_rate_spike', thirtyMinAgo)) {
            alerts.push({
                id: `burn_rate_spike-${now.getTime()}`,
                type: 'burn_rate_spike',
                threshold: avgBurn * config.burnRateSpikeMultiplier,
                currentValue: currentBurn,
                triggeredAt: now,
                acknowledged: false,
                message: `Burn rate spike detected: ${currentBurn} tokens (threshold: ${Math.round(avgBurn * config.burnRateSpikeMultiplier)})`,
            });
        }
    }
    // Check session budget
    if (config.sessionBudgetUsd !== undefined) {
        const row = internalDb
            .prepare(`SELECT id, total_cost_usd FROM sessions
         WHERE ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`)
            .get();
        if (row && row.total_cost_usd >= config.sessionBudgetUsd &&
            !recentAlertExists(internalDb, 'session_cost', thirtyMinAgo)) {
            alerts.push({
                id: `session_cost-${now.getTime()}`,
                type: 'session_cost',
                threshold: config.sessionBudgetUsd,
                currentValue: row.total_cost_usd,
                triggeredAt: now,
                acknowledged: false,
                message: `Session cost exceeded: $${row.total_cost_usd.toFixed(4)} / $${config.sessionBudgetUsd}`,
            });
        }
    }
    // Insert triggered alerts
    for (const alert of alerts) {
        internalDb.prepare(`INSERT INTO alert_events (id, type, threshold, current_value, triggered_at, acknowledged, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(alert.id, alert.type, alert.threshold, alert.currentValue, alert.triggeredAt.toISOString(), alert.acknowledged ? 1 : 0, alert.message);
    }
    return alerts;
}
function recentAlertExists(db, type, since) {
    const row = db
        .prepare("SELECT 1 FROM alert_events WHERE type = ? AND triggered_at >= ? LIMIT 1")
        .get(type, since);
    return !!row;
}
function loadAlertConfig(configPath) {
    const fullPath = configPath ?? path.join(os.homedir(), '.tokenwatch', 'config.json');
    if (!fs.existsSync(fullPath)) {
        return { dailyBudgetUsd: 10, burnRateSpikeMultiplier: 3 };
    }
    try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
    catch {
        return { dailyBudgetUsd: 10, burnRateSpikeMultiplier: 3 };
    }
}
function saveAlertConfig(config, configPath) {
    const fullPath = configPath ?? path.join(os.homedir(), '.tokenwatch', 'config.json');
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, JSON.stringify(config, null, 2));
}
//# sourceMappingURL=alert-evaluator.js.map