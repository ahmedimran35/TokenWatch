export interface Database {
    insertEvent(event: any): void;
    insertOrUpdateSession(session: any): void;
    hasMessageId(rawMessageId: string): boolean;
    getWatcherState(filePath: string): {
        lastPosition: number;
    } | null;
    setWatcherState(filePath: string, position: number): void;
    getDatabase(): any;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map