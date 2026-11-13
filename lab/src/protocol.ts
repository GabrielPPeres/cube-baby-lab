export const MESSAGE = {
  ACK: 0x00,
  IDENTITY: 0x11,
  ERASE: 0x21,
  MEMORY_WRITE: 0x22,
  MEMORY_READ: 0x23,
  REGISTER_WRITE: 0x24,
} as const;

export type DecodedMessage =
  | { kind: "ack"; rawValue: number; checksumValid: boolean }
  | { kind: "identity-request"; checksumValid: boolean }
  | { kind: "identity-response"; name: string; metadata: Uint8Array; checksumValid: boolean }
  | { kind: "memory-read-request"; memory: number; address: number; length: number; checksumValid: boolean }
  | { kind: "memory-read-response"; memory: number; address: number; length: number; data: Uint8Array; checksumValid: boolean }
  | { kind: "memory-write-request"; memory: number; address: number; length: number; data: Uint8Array; checksumValid: boolean }
  | { kind: "erase-request"; memory: number; address: number; checksumValid: boolean }
  | { kind: "register-write-request"; memory: number; address: number; value: number; checksumValid: boolean }
  | { kind: "unknown"; messageType: number; content: Uint8Array; checksumValid: boolean };

const u24le = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff];
const u32le = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
const read24 = (bytes: Uint8Array, at: number): number =>
  (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
const read32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16) | ((bytes[at + 3] ?? 0) << 24)) >>> 0;

function assertByte(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new RangeError(`${name} must be an unsigned byte`);
}

function assertAddress(address: number): void {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff) throw new RangeError("address must be an unsigned 32-bit integer");
}

function assertLength(length: number): void {
  if (!Number.isInteger(length) || length < 1 || length > 0xffffff) throw new RangeError("length must be from 1 to 16777215");
}

export function checksum(content: Uint8Array): number {
  let sum = 0;
  for (const byte of content) sum = (sum + byte) & 0xff;
  return (~sum) & 0xff;
}

/** CubeSuite's bit-stream packing, not the usual grouped-MSB MIDI packing. */
export function encodeSevenBit(source: Uint8Array): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let accumulator = 0;
  for (const byte of source) {
    accumulator = (accumulator | (byte << (bits & 0x1f))) >>> 0;
    bits += 1;
    for (;;) {
      out.push(accumulator & 0x7f);
      accumulator >>>= 7;
      if (bits < 7) break;
      bits -= 7;
    }
  }
  if (accumulator > 0) out.push(accumulator & 0x7f);
  const paddedLength = Math.ceil((source.length * 8) / 7);
  while (out.length < paddedLength) out.push(0);
  return Uint8Array.from(out);
}

export function decodeSevenBit(source: Uint8Array): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let previous = 0;
  for (const byte of source) {
    const mask = bits === 0 ? 0 : 0xffffffff >>> (32 - bits);
    const accumulator = byte & mask;
    if (bits > 0) out.push(((previous & 0x7f) | (accumulator << (8 - bits))) & 0xff);
    previous = byte >>> bits;
    bits = (bits + 1) % 8;
  }
  if (previous > 0) out.push(previous);
  return Uint8Array.from(out);
}

export function encodeEnvelope(type: number, content: Uint8Array): Uint8Array {
  assertByte("message type", type);
  if (content.length > 0xffffff) throw new RangeError("content is too large for the 24-bit envelope length");
  const clear = Uint8Array.of(0x00, 0x59, type, ...u24le(content.length), ...content, checksum(content));
  return Uint8Array.of(0xf0, ...encodeSevenBit(clear), 0xf7);
}

export const encodeIdentityRequest = (): Uint8Array => encodeEnvelope(MESSAGE.IDENTITY, new Uint8Array());

export function encodeMemoryRead(memory: number, address: number, length: number): Uint8Array {
  assertByte("memory", memory);
  assertAddress(address);
  assertLength(length);
  return encodeEnvelope(MESSAGE.MEMORY_READ, Uint8Array.of(memory, ...u32le(address), ...u24le(length)));
}

export function encodeMemoryWrite(memory: number, address: number, data: Uint8Array): Uint8Array {
  assertByte("memory", memory);
  assertAddress(address);
  assertLength(data.length);
  return encodeEnvelope(MESSAGE.MEMORY_WRITE, Uint8Array.of(memory, ...u32le(address), ...u24le(data.length), ...data));
}

export function encodeReadResponse(memory: number, address: number, data: Uint8Array): Uint8Array {
  assertByte("memory", memory);
  assertAddress(address);
  assertLength(data.length);
  return encodeEnvelope(MESSAGE.MEMORY_READ, Uint8Array.of(memory, ...u32le(address), ...u24le(data.length), ...data));
}

export const encodeAck = (rawValue = 0): Uint8Array => encodeEnvelope(MESSAGE.ACK, Uint8Array.of(rawValue));

export function decodeMessage(frame: Uint8Array): DecodedMessage {
  if (frame[0] !== 0xf0 || frame.at(-1) !== 0xf7) throw new Error("invalid SysEx markers");
  const clear = decodeSevenBit(frame.slice(1, -1));
  if (clear.length < 7 || clear[0] !== 0 || clear[1] !== 0x59) throw new Error("invalid Cube Baby envelope");
  const messageType = clear[2] ?? 0;
  const length = read24(clear, 3);
  if (clear.length !== 7 + length) throw new Error("declared content length mismatch");
  const content = clear.slice(6, 6 + length);
  const checksumValid = (clear[6 + length] ?? -1) === checksum(content);

  if (messageType === MESSAGE.ACK && content.length === 1) return { kind: "ack", rawValue: content[0] ?? 0, checksumValid };
  if (messageType === MESSAGE.IDENTITY && content.length === 0) return { kind: "identity-request", checksumValid };
  if (messageType === MESSAGE.IDENTITY) {
    const firstNonPrintable = content.findIndex((byte) => byte < 0x20 || byte > 0x7e);
    const nameLength = firstNonPrintable === -1 ? Math.min(16, content.length) : firstNonPrintable;
    return {
      kind: "identity-response",
      name: String.fromCharCode(...content.slice(0, nameLength)).trimEnd(),
      metadata: content.slice(nameLength),
      checksumValid,
    };
  }
  if (messageType === MESSAGE.MEMORY_READ && content.length >= 8) {
    const common = { memory: content[0] ?? 0, address: read32(content, 1), length: read24(content, 5), checksumValid };
    const data = content.slice(8);
    return data.length === 0 ? { kind: "memory-read-request", ...common } : { kind: "memory-read-response", ...common, data };
  }
  if (messageType === MESSAGE.MEMORY_WRITE && content.length >= 8) {
    return {
      kind: "memory-write-request",
      memory: content[0] ?? 0,
      address: read32(content, 1),
      length: read24(content, 5),
      data: content.slice(8),
      checksumValid,
    };
  }
  if (messageType === MESSAGE.ERASE && content.length === 5) return { kind: "erase-request", memory: content[0] ?? 0, address: read32(content, 1), checksumValid };
  if (messageType === MESSAGE.REGISTER_WRITE && content.length === 9) return { kind: "register-write-request", memory: content[0] ?? 0, address: read32(content, 1), value: read32(content, 5), checksumValid };
  return { kind: "unknown", messageType, content, checksumValid };
}
