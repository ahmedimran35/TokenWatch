"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorWatcher = void 0;
const chokidar = __importStar(require("chokidar"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const parser_1 = require("./parser");
const deduplicator_1 = require("./deduplicator");
class CollectorWatcher {
    watcher;
    db;
    deduplicator;
    onEvent;
    constructor(options) {
        this.db = options.db;
        this.deduplicator = new deduplicator_1.Deduplicator(options.db);
        this.onEvent = options.onEvent;
    }
    async start() {
        const watchDir = path.join(os.homedir(), '.claude', 'projects');
        this.watcher = chokidar.watch('**/*.jsonl', {
            cwd: watchDir,
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: { stabilityThreshold: 200 },
        });
        this.watcher.on('add', (relativePath) => {
            const fullPath = path.join(watchDir, relativePath);
            this.processFile(fullPath, true);
        });
        this.watcher.on('change', (relativePath) => {
            const fullPath = path.join(watchDir, relativePath);
            this.processFile(fullPath, false);
        });
        this.watcher.on('error', (error) => {
            console.error('Watcher error:', error);
        });
    }
    processFile(filePath, fromBeginning = false) {
        try {
            const state = this.db.getWatcherState(filePath);
            const startPosition = fromBeginning ? 0 : (state?.lastPosition ?? 0);
            const stats = fs.statSync(filePath);
            if (stats.size < startPosition) {
                // File was truncated, read from beginning
                this.processFromPosition(filePath, 0, stats.size);
                return;
            }
            this.processFromPosition(filePath, startPosition, stats.size);
        }
        catch (error) {
            // File may have been deleted or permission denied
            if (error.code !== 'ENOENT') {
                console.error(`Error processing file ${filePath}:`, error);
            }
        }
    }
    processFromPosition(filePath, start, end) {
        const fd = fs.openSync(filePath, 'r');
        const bufferSize = end - start;
        if (bufferSize <= 0) {
            fs.closeSync(fd);
            return;
        }
        const buffer = Buffer.alloc(bufferSize);
        fs.readSync(fd, buffer, 0, bufferSize, start);
        fs.closeSync(fd);
        const content = buffer.toString('utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        let newPosition = start + buffer.length;
        for (const line of lines) {
            const event = (0, parser_1.parseLine)(line, filePath);
            if (!event)
                continue;
            if (this.deduplicator.isDuplicate(event.id)) {
                continue;
            }
            this.db.insertEvent(event);
            this.updateSession(event);
            if (this.onEvent) {
                this.onEvent(event);
            }
        }
        this.db.setWatcherState(filePath, newPosition);
    }
    updateSession(event) {
        const session = {
            id: event.sessionId,
            projectPath: event.projectPath,
            projectName: event.projectName,
            provider: event.provider,
            startedAt: event.timestamp,
            endedAt: event.timestamp,
            totalInputTokens: event.inputTokens,
            totalOutputTokens: event.outputTokens,
            totalCacheReadTokens: event.cacheReadTokens,
            totalCacheWriteTokens: event.cacheWriteTokens,
            totalTokens: event.totalTokens,
            totalCostUsd: event.costUsd,
            eventCount: 1,
            modelsUsed: [event.model],
            toolsUsed: event.toolName ? [event.toolName] : [],
        };
        this.db.insertOrUpdateSession(session);
    }
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
        }
    }
}
exports.CollectorWatcher = CollectorWatcher;
//# sourceMappingURL=watcher.js.map