"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelStats = getModelStats;
function getModelStats(db, options) {
    const internalDb = db.getDatabase();
    const rows = internalDb
        .prepare(`SELECT
        model,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cache_write_tokens) as total_cache_write,
        SUM(cost_usd) as total_cost,
        COUNT(*) as call_count
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY model
       ORDER BY total_cost DESC`)
        .all(options.from.toISOString(), options.to.toISOString());
    return rows.map((r) => ({
        model: r.model,
        totalInputTokens: r.total_input,
        totalOutputTokens: r.total_output,
        totalCacheReadTokens: r.total_cache_read,
        totalCacheWriteTokens: r.total_cache_write,
        totalCostUsd: r.total_cost,
        callCount: r.call_count,
        avgCostPerCall: r.call_count > 0 ? r.total_cost / r.call_count : 0,
    }));
}
//# sourceMappingURL=model-stats.js.map