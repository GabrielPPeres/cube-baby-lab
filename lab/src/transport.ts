import { decodeMessage, encodeAck, encodeReadResponse } from "./protocol.ts";
import { TransportTimeoutError } from "./errors.ts";
import type { OperationLogger } from "./operation-log.ts";
import { bytesToHex } from "./presets.ts";
import { LIVE_BASE_ADDRESS, PRESET_BANK_ADDRESS, PRESET_BANK_BYTES, PRESET_MEMORY } from "./presets.ts";

export interface FrameTransport {
  readonly kind: "usb-midi" | "bluetooth-experimental" | "simulated";
  exchange(request: Uint8Array, timeoutMs?: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

export async function exchangeWithTimeout(
  transport: FrameTransport,
  request: Uint8Array,
  timeoutMs: number,
): Promise<Uint8Array> {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be a positive integer");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      transport.exchange(request, timeoutMs),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TransportTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface MidiSysExPortPair {
  exchangeSysEx(request: Uint8Array, timeoutMs: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** USB-MIDI carries the observed SysEx bytes unchanged. Platform enumeration stays outside. */
export class UsbMidiTransport implements FrameTransport {
  readonly kind = "usb-midi" as const;
  private readonly ports: MidiSysExPortPair;
  constructor(ports: MidiSysExPortPair) { this.ports = ports; }
  exchange(request: Uint8Array, timeoutMs = 1500): Promise<Uint8Array> { return this.ports.exchangeSysEx(request, timeoutMs); }
  close(): Promise<void> { return this.ports.close(); }
}

/** @deprecated Phase-1 proof seam. New Bluetooth work uses src/bluetooth/transport.ts. */
export interface ExperimentalBluetoothFrameProfile {
  /** Must be established by a hardware capture, not inferred from USB. */
  readonly verifiedOnCubeBaby: boolean;
  readonly evidenceId: string;
  encodeProtocolFrame(frame: Uint8Array): readonly Uint8Array[];
  decodeNotifications(chunks: readonly Uint8Array[]): Uint8Array;
}

export interface BluetoothGattLink {
  exchangeNotifications(writes: readonly Uint8Array[], timeoutMs: number): Promise<readonly Uint8Array[]>;
  close(): Promise<void>;
}

/** No default BLE-MIDI, GATT UUID, or SysEx assumption is embedded here. */
export class ExperimentalBluetoothTransport implements FrameTransport {
  readonly kind = "bluetooth-experimental" as const;
  private readonly link: BluetoothGattLink;
  private readonly profile: ExperimentalBluetoothFrameProfile;
  constructor(link: BluetoothGattLink, profile: ExperimentalBluetoothFrameProfile) {
    this.link = link;
    this.profile = profile;
  }
  async exchange(request: Uint8Array, timeoutMs = 1500): Promise<Uint8Array> {
    if (!this.profile.verifiedOnCubeBaby) throw new Error("Bluetooth control profile is unverified; transmit is disabled");
    const notifications = await this.link.exchangeNotifications(this.profile.encodeProtocolFrame(request), timeoutMs);
    return this.profile.decodeNotifications(notifications);
  }
  close(): Promise<void> { return this.link.close(); }
}

export class SimulatedTransport implements FrameTransport {
  readonly kind = "simulated" as const;
  readonly bank: Uint8Array;
  readonly live = new Uint8Array(0x2d);
  readonly requests: Uint8Array[] = [];
  private readonly options: SimulatedTransportOptions;
  private readonly logger?: OperationLogger;
  constructor(bank: Uint8Array, options: SimulatedTransportOptions = {}, logger?: OperationLogger) {
    if (bank.length !== PRESET_BANK_BYTES) throw new Error("simulator requires a 48-byte bank");
    this.bank = bank.slice();
    this.options = options;
    this.logger = logger;
    this.live.set(this.bank.subarray(0, this.live.length));
  }
  async exchange(request: Uint8Array): Promise<Uint8Array> {
    this.requests.push(request.slice());
    this.logger?.record({ level: "info", scope: "simulated.transport", event: "frame", direction: "tx", message: "Simulated request", dataHex: bytesToHex(request) });
    if (this.options.dropReplies === true) return new Promise<Uint8Array>(() => undefined);
    if ((this.options.replyDelayMs ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, this.options.replyDelayMs));
    const message = decodeMessage(request);
    if (message.kind === "memory-read-request" && message.memory === PRESET_MEMORY && message.address === PRESET_BANK_ADDRESS && message.length === PRESET_BANK_BYTES) {
      const data = this.options.overrideReadBank?.slice() ?? this.bank;
      const response = encodeReadResponse(PRESET_MEMORY, PRESET_BANK_ADDRESS, data);
      if (this.options.corruptReadChecksum === true) response[response.length - 2] = (response[response.length - 2] ?? 0) ^ 1;
      this.logger?.record({ level: "info", scope: "simulated.transport", event: "frame", direction: "rx", message: "Simulated read response", dataHex: bytesToHex(response) });
      return response;
    }
    if (message.kind === "memory-write-request" && message.memory === PRESET_MEMORY) {
      if (message.address === PRESET_BANK_ADDRESS && message.data.length === PRESET_BANK_BYTES && this.options.ignoreBankWrites !== true) this.bank.set(message.data);
      if (message.address >= LIVE_BASE_ADDRESS) {
        const at = message.address - LIVE_BASE_ADDRESS;
        if (at >= 0 && at < this.live.length) this.live.set(message.data.subarray(0, this.live.length - at), at);
      }
      // Captured physical writes answer with raw 0. This is still an ACK frame.
      const response = encodeAck(0);
      this.logger?.record({ level: "info", scope: "simulated.transport", event: "frame", direction: "rx", message: "Simulated ACK", dataHex: bytesToHex(response) });
      return response;
    }
    throw new Error(`simulator has no reply for ${message.kind}`);
  }
  async close(): Promise<void> {}
}

export interface SimulatedTransportOptions {
  readonly replyDelayMs?: number;
  readonly dropReplies?: boolean;
  readonly corruptReadChecksum?: boolean;
  readonly ignoreBankWrites?: boolean;
  readonly overrideReadBank?: Uint8Array;
}
