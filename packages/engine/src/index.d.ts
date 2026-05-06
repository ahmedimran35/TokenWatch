import { Database } from './database';
import type { LiveStats, Alert } from '@tokenwatch/types';
import { getToday } from './aggregator';
import { getTopSessions } from './session-ranker';
export declare class AnalyticsEngine {
    private db;
    constructor(db: Database);
    getLiveStats(): LiveStats;
    getStats: typeof getToday;
    getProjectStats: any;
    getModelStats: any;
    getTopSessions: typeof getTopSessions;
    getSessionTimeline: any;
    getCacheStats: any;
    getBurnRateHistory: any;
    evaluateAlerts(): Alert[];
    getBurnRate(windowMinutes?: number): import("@tokenwatch/types").BurnRate;
}
export * from './burn-rate';
export * from './aggregator';
export * from './project-stats';
export * from './model-stats';
export * from './session-ranker';
export * from './alert-evaluator';
export * from './cache-stats';
//# sourceMappingURL=index.d.ts.map