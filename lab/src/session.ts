import { decodeMessage, encodeMemoryRead, encodeMemoryWrite } from "./protocol.ts";
import { VerificationError } from "./errors.ts";
import type { OperationLogger } from "./operation-log.ts";
import { decodeBank, liveAddress, patchBank, PRESET_BANK_ADDRESS, PRESET_BANK_BYTES, PRESET_MEMORY, type PresetBank, type PresetParam, type SlotId } from "./presets.ts";
import { exchangeWithTimeout, type FrameTransport } from "./transport.ts";

export interface EditResult {
  before: PresetBank;
  written: PresetBank;
  after: PresetBank;
  ackRawValue: number;
  verified: boolean;
}

export class PresetSession {
  private readonly transport: FrameTransport;
  private readonly timeoutMs: number;
  private readonly logger?: OperationLogger;
  constructor(transport: FrameTransport, options: PresetSessionOptions = {}) {
    this.transport = transport;
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.logger = options.logger;
  }

  async readBank(): Promise<PresetBank> {
    const frame = await exchangeWithTimeout(this.transport, encodeMemoryRead(PRESET_MEMORY, PRESET_BANK_ADDRESS, PRESET_BANK_BYTES), this.timeoutMs);
    const response = decodeMessage(frame);
    if (response.kind !== "memory-read-response" || !response.checksumValid || response.memory !== PRESET_MEMORY || response.address !== PRESET_BANK_ADDRESS || response.length !== PRESET_BANK_BYTES || response.data.length !== PRESET_BANK_BYTES) {
      throw new Error("invalid preset-bank read response");
    }
    const bank = decodeBank(response.data);
    this.logger?.record({ level: "info", scope: "preset.session", event: "bank-read", direction: "internal", message: "Read 48-byte A/B/C preset bank" });
    return bank;
  }

  async preview(slot: SlotId, param: PresetParam, value: number): Promise<number> {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new RangeError("preview value must be an unsigned byte");
    const response = decodeMessage(await exchangeWithTimeout(this.transport, encodeMemoryWrite(PRESET_MEMORY, liveAddress(slot, param), Uint8Array.of(value)), this.timeoutMs));
    if (response.kind !== "ack" || !response.checksumValid) throw new Error("missing valid live-write ACK");
    this.logger?.record({ level: "info", scope: "preset.session", event: "preview", direction: "internal", message: `Previewed ${slot}.${param}`, details: { value, address: liveAddress(slot, param), ackRawValue: response.rawValue } });
    return response.rawValue;
  }

  /** Read-modify-write of all 48 bytes, then read-back verification. */
  async edit(slot: SlotId, param: PresetParam, value: number): Promise<EditResult> {
    const before = await this.readBank();
    const written = patchBank(before, slot, param, value);
    const ack = decodeMessage(await exchangeWithTimeout(this.transport, encodeMemoryWrite(PRESET_MEMORY, PRESET_BANK_ADDRESS, written.raw), this.timeoutMs));
    if (ack.kind !== "ack" || !ack.checksumValid) throw new Error("missing valid bank-write ACK");
    const after = await this.readBank();
    const verified = after.raw.every((byte, index) => byte === written.raw[index]);
    if (!verified) throw new VerificationError();
    this.logger?.record({ level: "info", scope: "preset.session", event: "bank-edit", direction: "internal", message: `Persisted and verified ${slot}.${param}`, details: { value, ackRawValue: ack.rawValue } });
    return { before, written, after, ackRawValue: ack.rawValue, verified };
  }

  async restoreBank(bank: PresetBank): Promise<PresetBank> {
    if (bank.raw.length !== PRESET_BANK_BYTES) throw new Error(`bank must contain exactly ${PRESET_BANK_BYTES} bytes`);
    const ack = decodeMessage(await exchangeWithTimeout(this.transport, encodeMemoryWrite(PRESET_MEMORY, PRESET_BANK_ADDRESS, bank.raw), this.timeoutMs));
    if (ack.kind !== "ack" || !ack.checksumValid) throw new Error("missing valid bank-restore ACK");
    const after = await this.readBank();
    if (!after.raw.every((byte, index) => byte === bank.raw[index])) throw new VerificationError("restored preset bank failed read-back verification");
    this.logger?.record({ level: "info", scope: "preset.session", event: "bank-restore", direction: "internal", message: "Restored and verified the complete 48-byte preset bank", details: { ackRawValue: ack.rawValue } });
    return after;
  }

  close(): Promise<void> { return this.transport.close(); }
}

export interface PresetSessionOptions {
  readonly timeoutMs?: number;
  readonly logger?: OperationLogger;
}
