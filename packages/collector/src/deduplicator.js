"use strict";
// Deduplication is handled directly by the Database class using raw_message_id UNIQUE constraint
// This file serves as a thin wrapper for any future dedup logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deduplicator = void 0;
class Deduplicator {
    db;
    constructor(db) {
        this.db = db;
    }
    isDuplicate(rawMessageId) {
        return this.db.hasMessageId(rawMessageId);
    }
}
exports.Deduplicator = Deduplicator;
//# sourceMappingURL=deduplicator.js.map