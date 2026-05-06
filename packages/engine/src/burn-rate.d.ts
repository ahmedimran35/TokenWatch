import { Database } from './database';
import type { BurnRate } from '@tokenwatch/types';
export declare function calculateBurnRate(db: Database, windowMinutes?: number): BurnRate;
export declare function getBurnRateHistory(db: Database, periodHours: number, bucketMinutes: number): Array<{
    bucketStart: Date;
    tokensPerMinute: number;
    costPerMinute: number;
}>;
//# sourceMappingURL=burn-rate.d.ts.map