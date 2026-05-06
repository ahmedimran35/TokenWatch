import { Database } from './database';
export interface CacheStatsResult {
    hitRate: number;
    totalCacheReads: number;
    totalCacheWrites: number;
    estimatedSavingsUsd: number;
    dailyHitRates: Array<{
        date: string;
        hitRate: number;
    }>;
}
export declare function getCacheStats(db: Database, options: {
    from: Date;
    to: Date;
}): CacheStatsResult;
//# sourceMappingURL=cache-stats.d.ts.map