"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectStats = getProjectStats;
function getProjectStats(db, options) {
    const internalDb = db.getDatabase();
    const limit = options.limit ?? 20;
    const rows = internalDb
        .prepare(`SELECT
        project_name,
        project_path,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_active
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY project_name, project_path
       ORDER BY total_cost DESC
       LIMIT ?`)
        .all(options.from.toISOString(), options.to.toISOString(), limit);
    return rows.map((r) => ({
        projectName: r.project_name,
        projectPath: r.project_path,
        totalTokens: r.total_tokens,
        totalCostUsd: r.total_cost,
        sessionCount: r.session_count,
        avgCostPerSession: r.session_count > 0 ? r.total_cost / r.session_count : 0,
        lastActiveAt: new Date(r.last_active),
    }));
}
//# sourceMappingURL=project-stats.js.map