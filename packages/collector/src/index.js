"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deduplicator = exports.calculateCost = exports.parseLine = exports.CollectorWatcher = exports.Database = void 0;
exports.startCollector = startCollector;
const database_1 = require("./database");
const watcher_1 = require("./watcher");
async function startCollector(options) {
    const db = new database_1.Database();
    const watcher = new watcher_1.CollectorWatcher({ db, onEvent: options?.onEvent });
    await watcher.start();
    process.on('SIGINT', () => {
        watcher.stop();
        db.close();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        watcher.stop();
        db.close();
        process.exit(0);
    });
    return { db, watcher };
}
var database_2 = require("./database");
Object.defineProperty(exports, "Database", { enumerable: true, get: function () { return database_2.Database; } });
var watcher_2 = require("./watcher");
Object.defineProperty(exports, "CollectorWatcher", { enumerable: true, get: function () { return watcher_2.CollectorWatcher; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseLine", { enumerable: true, get: function () { return parser_1.parseLine; } });
var pricing_1 = require("./pricing");
Object.defineProperty(exports, "calculateCost", { enumerable: true, get: function () { return pricing_1.calculateCost; } });
var deduplicator_1 = require("./deduplicator");
Object.defineProperty(exports, "Deduplicator", { enumerable: true, get: function () { return deduplicator_1.Deduplicator; } });
//# sourceMappingURL=index.js.map