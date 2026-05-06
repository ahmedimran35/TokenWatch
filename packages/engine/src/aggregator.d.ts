import { Database } from './database';
import type { DailyStats } from '@tokenwatch/types';
export interface StatsResult {
    totalTokens: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    cacheHitRate: number;
    sessionCount: number;
    avgCostPerSession: number;
    avgTokensPerSession: number;
    dailyBreakdown: DailyStats[];
}
export declare function getStats(db: Database, options: {
    from: Date;
    to: Date;
    projectPath?: string;
    provider?: string;
}): StatsResult;
export declare function getToday(db: Database): StatsResult;
export declare function getThisWeek(db: Database): StatsResult;
export declare function getThisMonth(db: Database): StatsResult;
export declare function getLast30Days(db: Database): StatsResult;
export declare function getAllTime(db: Database): StatsResult;
//# sourceMappingURL=aggregator.d.ts.map