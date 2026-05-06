// Database interface - matches collector's Database class

export interface Database {
  getDatabase(): any
  insertEvent(event: any): boolean
  insertOrUpdateSession(session: any): void
  hasMessageId(rawMessageId: string): boolean
  getWatcherState(filePath: string): { lastPosition: number } | null
  setWatcherState(filePath: string, position: number): void
  close(): void
}
