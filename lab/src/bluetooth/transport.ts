import { TransportDisconnectedError } from "../errors.ts";
import type { OperationLogger } from "../operation-log.ts";
import { bytesToHex } from "../presets.ts";

export type BluetoothTransportState = "disconnected" | "connecting" | "connected" | "disconnecting";

export interface BluetoothControlProfile {
  readonly profileId: string;
  readonly technology: "classic" | "ble";
  readonly verifiedOnCubeBaby: boolean;
  readonly evidenceIds: readonly string[];
  readonly framingDescription: string;
}

export interface BluetoothConnectionTarget {
  readonly observationId: string;
  readonly addressOrId: string;
}

export interface BluetoothTransport {
  readonly state: BluetoothTransportState;
  readonly profile: BluetoothControlProfile | null;
  connect(target: BluetoothConnectionTarget, profile: BluetoothControlProfile): Promise<void>;
  disconnect(): Promise<void>;
  exchangeProtocolFrame(frame: Uint8Array, timeoutMs: number): Promise<Uint8Array>;
}

export interface MockBluetoothOptions {
  readonly reply?: (frame: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  readonly connectError?: Error;
}

/**
 * Hardware-free transport. It starts disconnected and refuses unverified profiles.
 * Test data is caller supplied; it defines no Cube Baby UUID or service.
 */
export class MockBluetoothTransport implements BluetoothTransport {
  private currentState: BluetoothTransportState = "disconnected";
  private currentProfile: BluetoothControlProfile | null = null;
  private readonly options: MockBluetoothOptions;
  private readonly logger?: OperationLogger;

  constructor(options: MockBluetoothOptions = {}, logger?: OperationLogger) {
    this.options = options;
    this.logger = logger;
  }

  get state(): BluetoothTransportState { return this.currentState; }
  get profile(): BluetoothControlProfile | null { return this.currentProfile; }

  async connect(target: BluetoothConnectionTarget, profile: BluetoothControlProfile): Promise<void> {
    if (!profile.verifiedOnCubeBaby || profile.evidenceIds.length === 0) {
      throw new Error("Bluetooth control profile lacks physical Cube Baby evidence; connect is blocked");
    }
    this.currentState = "connecting";
    this.logger?.record({ level: "info", scope: "bluetooth.transport", event: "connect", direction: "internal", message: `Connecting mock target ${target.observationId}`, details: { profileId: profile.profileId, technology: profile.technology } });
    if (this.options.connectError !== undefined) {
      this.currentState = "disconnected";
      throw this.options.connectError;
    }
    this.currentProfile = profile;
    this.currentState = "connected";
  }

  async disconnect(): Promise<void> {
    if (this.currentState === "disconnected") return;
    this.currentState = "disconnecting";
    this.currentProfile = null;
    this.currentState = "disconnected";
    this.logger?.record({ level: "info", scope: "bluetooth.transport", event: "disconnect", direction: "internal", message: "Mock Bluetooth transport disconnected" });
  }

  async exchangeProtocolFrame(frame: Uint8Array, _timeoutMs: number): Promise<Uint8Array> {
    if (this.currentState !== "connected" || this.currentProfile === null) throw new TransportDisconnectedError("Bluetooth transport is disconnected by default");
    if (!this.currentProfile.verifiedOnCubeBaby) throw new Error("unverified Bluetooth profile cannot transmit");
    this.logger?.record({ level: "info", scope: "bluetooth.transport", event: "frame", direction: "tx", message: "Mock protocol frame sent", dataHex: bytesToHex(frame) });
    if (this.options.reply === undefined) throw new Error("mock Bluetooth transport has no reply handler");
    const reply = await this.options.reply(frame.slice());
    this.logger?.record({ level: "info", scope: "bluetooth.transport", event: "frame", direction: "rx", message: "Mock protocol frame received", dataHex: bytesToHex(reply) });
    return reply.slice();
  }
}
