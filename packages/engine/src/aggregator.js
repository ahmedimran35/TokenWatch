"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = getStats;
exports.getToday = getToday;
exports.getThisWeek = getThisWeek;
exports.getThisMonth = getThisMonth;
exports.getLast30Days = getLast30Days;
exports.getAllTime = getAllTime;
function getStats(db, options) {
    const internalDb = db.getDatabase();
    let whereClause = 'WHERE timestamp >= ? AND timestamp <= ?';
    const params = [options.from.toISOString(), options.to.toISOString()];
    if (options.projectPath) {
        whereClause += ' AND project_path = ?';
        params.push(options.projectPath);
    }
    if (options.provider) {
        whereClause += ' AND provider = ?';
        params.push(options.provider);
    }
    const aggRow = internalDb
        .prepare(`SELECT
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_write,
        COUNT(DISTINCT session_id) as session_count
       FROM token_events ${whereClause}`)
        .get(...params);
    const totalTokens = aggRow.total_tokens;
    const totalInputTokens = aggRow.total_input;
    const totalCacheReadTokens = aggRow.total_cache_read;
    const cacheHitRate = totalInputTokens + totalCacheReadTokens > 0
        ? totalCacheReadTokens / (totalInputTokens + totalCacheReadTokens)
        : 0;
    // Daily breakdown
    const dailyRows = internalDb
        .prepare(`SELECT
        date(timestamp) as date,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost,
        COUNT(DISTINCT session_id) as sessions,
        model as top_model,
        project_name as top_project
       FROM token_events ${whereClause}
       GROUP BY date(timestamp)
       ORDER BY date`)
        .all(...params);
    const dailyBreakdown = dailyRows.map((r) => ({
        date: r.date,
        totalTokens: r.tokens,
        totalCostUsd: r.cost,
        sessionCount: r.sessions,
        topModel: r.top_model,
        topProject: r.top_project,
    }));
    const sessionCount = aggRow.session_count;
    return {
        totalTokens,
        totalCostUsd: aggRow.total_cost,
        totalInputTokens,
        totalOutputTokens: aggRow.total_output,
        totalCacheReadTokens,
        totalCacheWriteTokens: aggRow.total_cache_write,
        cacheHitRate,
        sessionCount,
        avgCostPerSession: sessionCount > 0 ? aggRow.total_cost / sessionCount : 0,
        avgTokensPerSession: sessionCount > 0 ? totalTokens / sessionCount : 0,
        dailyBreakdown,
    };
}
function getToday(db) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return getStats(db, { from: start, to: now });
}
function getThisWeek(db) {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getStats(db, { from: start, to: now });
}
function getThisMonth(db) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return getStats(db, { from: start, to: now });
}
function getLast30Days(db) {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return getStats(db, { from: start, to: now });
}
function getAllTime(db) {
    return getStats(db, { from: new Date(0), to: new Date() });
}
//# sourceMappingURL=aggregator.js.map