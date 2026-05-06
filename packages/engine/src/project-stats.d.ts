import { Database } from './database';
import type { ProjectStats } from '@tokenwatch/types';
export declare function getProjectStats(db: Database, options: {
    from: Date;
    to: Date;
    limit?: number;
}): ProjectStats[];
//# sourceMappingURL=project-stats.d.ts.map