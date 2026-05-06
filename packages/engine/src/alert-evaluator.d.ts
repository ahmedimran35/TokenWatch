import { Database } from './database';
import type { Alert, AlertConfig } from '@tokenwatch/types';
export declare function evaluateAlerts(db: Database, config: AlertConfig): Alert[];
export declare function loadAlertConfig(configPath?: string): AlertConfig;
export declare function saveAlertConfig(config: AlertConfig, configPath?: string): void;
//# sourceMappingURL=alert-evaluator.d.ts.map