import { Database as BetterSqlite3Database } from 'better-sqlite3';
import type { TokenEvent, Session } from '@tokenwatch/types';
export declare class Database {
    private db;
    constructor(dbPath?: string);
    private runMigrations;
    insertEvent(event: TokenEvent): void;
    insertOrUpdateSession(session: Session): void;
    hasMessageId(rawMessageId: string): boolean;
    getWatcherState(filePath: string): {
        lastPosition: number;
    } | null;
    setWatcherState(filePath: string, position: number): void;
    getDatabase(): BetterSqlite3Database;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map