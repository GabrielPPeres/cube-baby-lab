export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogDirection = "internal" | "tx" | "rx";

export interface OperationLogEntry {
  readonly sequence: number;
  readonly at: string;
  readonly level: LogLevel;
  readonly scope: string;
  readonly event: string;
  readonly direction: LogDirection;
  readonly message: string;
  readonly dataHex?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface OperationLogger {
  record(entry: Omit<OperationLogEntry, "sequence" | "at">): OperationLogEntry;
  entries(): readonly OperationLogEntry[];
  clear(): void;
}

export class MemoryOperationLogger implements OperationLogger {
  private readonly buffer: OperationLogEntry[] = [];
  private nextSequence = 1;

  record(entry: Omit<OperationLogEntry, "sequence" | "at">): OperationLogEntry {
    const stored: OperationLogEntry = {
      sequence: this.nextSequence,
      at: new Date().toISOString(),
      ...entry,
    };
    this.nextSequence += 1;
    this.buffer.push(stored);
    return stored;
  }

  entries(): readonly OperationLogEntry[] {
    return this.buffer.map((entry) => ({ ...entry }));
  }

  clear(): void {
    this.buffer.length = 0;
  }
}
