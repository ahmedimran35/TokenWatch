import { Database } from './database';
import type { TokenEvent } from '@tokenwatch/types';
export declare class CollectorWatcher {
    private watcher?;
    private db;
    private deduplicator;
    private onEvent?;
    constructor(options: {
        db: Database;
        onEvent?: (event: TokenEvent) => void;
    });
    start(): Promise<void>;
    processFile(filePath: string, fromBeginning?: boolean): void;
    private processFromPosition;
    private updateSession;
    stop(): void;
}
//# sourceMappingURL=watcher.d.ts.map