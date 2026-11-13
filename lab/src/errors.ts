export class TransportTimeoutError extends Error {
  readonly code = "TRANSPORT_TIMEOUT";
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`transport timed out after ${timeoutMs} ms`);
    this.name = "TransportTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class TransportDisconnectedError extends Error {
  readonly code = "TRANSPORT_DISCONNECTED";
  constructor(message = "transport is disconnected") {
    super(message);
    this.name = "TransportDisconnectedError";
  }
}

export class VerificationError extends Error {
  readonly code = "READ_BACK_MISMATCH";
  constructor(message = "preset bank read-back did not match the written bytes") {
    super(message);
    this.name = "VerificationError";
  }
}
