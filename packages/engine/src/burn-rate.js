"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBurnRate = calculateBurnRate;
exports.getBurnRateHistory = getBurnRateHistory;
function calculateBurnRate(db, windowMinutes = 5) {
    const internalDb = db.getDatabase();
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const row = internalDb
        .prepare(`SELECT COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as total_cost
       FROM token_events WHERE timestamp >= ?`)
        .get(since);
    const totalTokens = row.total_tokens;
    const totalCost = row.total_cost;
    if (totalTokens === 0) {
        return {
            tokensPerMinute: 0,
            tokensPerHour: 0,
            tokensPerDay: 0,
            costPerMinute: 0,
            costPerHour: 0,
            costPerDay: 0,
            windowMinutes,
            sampledAt: new Date(),
        };
    }
    const tokensPerMinute = totalTokens / windowMinutes;
    const costPerMinute = totalCost / windowMinutes;
    return {
        tokensPerMinute: Math.round(tokensPerMinute),
        tokensPerHour: Math.round(tokensPerMinute * 60),
        tokensPerDay: Math.round(tokensPerMinute * 60 * 24),
        costPerMinute: costPerMinute,
        costPerHour: costPerMinute * 60,
        costPerDay: costPerMinute * 60 * 24,
        windowMinutes,
        sampledAt: new Date(),
    };
}
function getBurnRateHistory(db, periodHours, bucketMinutes) {
    const internalDb = db.getDatabase();
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();
    // SQLite doesn't have a great date bucketing function, so we'll do it in JS
    const rows = internalDb
        .prepare(`SELECT timestamp, total_tokens, cost_usd
       FROM token_events WHERE timestamp >= ? ORDER BY timestamp`)
        .all(since);
    const buckets = new Map();
    const bucketMs = bucketMinutes * 60 * 1000;
    for (const row of rows) {
        const ts = new Date(row.timestamp).getTime();
        const bucketStart = Math.floor(ts / bucketMs) * bucketMs;
        const existing = buckets.get(bucketStart);
        if (existing) {
            existing.tokens += row.total_tokens;
            existing.cost += row.cost_usd;
            existing.count += 1;
        }
        else {
            buckets.set(bucketStart, { tokens: row.total_tokens, cost: row.cost_usd, count: 1 });
        }
    }
    const result = [];
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    for (const key of sortedKeys) {
        const bucket = buckets.get(key);
        result.push({
            bucketStart: new Date(key),
            tokensPerMinute: bucket.tokens / bucketMinutes,
            costPerMinute: bucket.cost / bucketMinutes,
        });
    }
    return result;
}
//# sourceMappingURL=burn-rate.js.map