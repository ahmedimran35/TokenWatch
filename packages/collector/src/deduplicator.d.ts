import { Database } from './database';
export declare class Deduplicator {
    private db;
    constructor(db: Database);
    isDuplicate(rawMessageId: string): boolean;
}
//# sourceMappingURL=deduplicator.d.ts.map