import { Database } from './database';
import { CollectorWatcher } from './watcher';
import type { TokenEvent } from '@tokenwatch/types';
export declare function startCollector(options?: {
    onEvent?: (event: TokenEvent) => void;
    onError?: (error: Error) => void;
}): Promise<{
    db: Database;
    watcher: CollectorWatcher;
}>;
export { Database } from './database';
export { CollectorWatcher } from './watcher';
export { parseLine } from './parser';
export { calculateCost } from './pricing';
export { Deduplicator } from './deduplicator';
//# sourceMappingURL=index.d.ts.map