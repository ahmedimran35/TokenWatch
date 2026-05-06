import { Database } from './database';
import type { Session, TokenEvent } from '@tokenwatch/types';
export declare function getTopSessions(db: Database, options: {
    from: Date;
    to: Date;
    limit?: number;
    sortBy?: 'cost' | 'tokens' | 'duration';
}): Session[];
export declare function getSessionTimeline(db: Database, sessionId: string): TokenEvent[];
//# sourceMappingURL=session-ranker.d.ts.map