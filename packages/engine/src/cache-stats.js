"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheStats = getCacheStats;
function getCacheStats(db, options) {
    const internalDb = db.getDatabase();
    const row = internalDb
        .prepare(`SELECT
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_write
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?`)
        .get(options.from.toISOString(), options.to.toISOString());
    const totalInput = row.total_input;
    const totalCacheRead = row.total_cache_read;
    const totalCacheWrite = row.total_cache_write;
    const hitRate = totalInput + totalCacheRead > 0 ? totalCacheRead / (totalInput + totalCacheRead) : 0;
    // Estimate savings: if cache reads had been input tokens at sonnet pricing ($3/million)
    const estimatedSavingsUsd = (totalCacheRead * 3) / 1_000_000;
    const dailyRows = internalDb
        .prepare(`SELECT
        date(timestamp) as date,
        SUM(input_tokens) as total_input,
        SUM(cache_read_tokens) as total_cache_read
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY date(timestamp)
       ORDER BY date`)
        .all(options.from.toISOString(), options.to.toISOString());
    const dailyHitRates = dailyRows.map((r) => ({
        date: r.date,
        hitRate: r.total_input + r.total_cache_read > 0 ? r.total_cache_read / (r.total_input + r.total_cache_read) : 0,
    }));
    return {
        hitRate,
        totalCacheReads: totalCacheRead,
        totalCacheWrites: totalCacheWrite,
        estimatedSavingsUsd,
        dailyHitRates,
    };
}
//# sourceMappingURL=cache-stats.js.map