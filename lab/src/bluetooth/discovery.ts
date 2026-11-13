import type { OperationLogger } from "../operation-log.ts";
import type {
  BluetoothDeviceObservation,
  BluetoothDiscoveryReport,
  GattInventory,
  SdpInventory,
} from "./types.ts";

export interface BluetoothClassicDiscoveryAdapter {
  scanClassic(signal?: AbortSignal): Promise<readonly BluetoothDeviceObservation[]>;
  inspectSdp(device: BluetoothDeviceObservation, signal?: AbortSignal): Promise<SdpInventory>;
}

export interface BluetoothBleDiscoveryAdapter {
  scanBle(signal?: AbortSignal): Promise<readonly BluetoothDeviceObservation[]>;
  /** Connects only long enough to enumerate GATT. It must never write a characteristic. */
  inspectGattReadOnly(device: BluetoothDeviceObservation, signal?: AbortSignal): Promise<GattInventory>;
}

export interface DiscoveryOptions {
  readonly inspectClassicSdp?: boolean;
  readonly inspectBleGatt?: boolean;
  readonly signal?: AbortSignal;
}

export class BluetoothDiscoveryCoordinator {
  private readonly classic: BluetoothClassicDiscoveryAdapter | null;
  private readonly ble: BluetoothBleDiscoveryAdapter | null;
  private readonly logger?: OperationLogger;
  constructor(
    classic: BluetoothClassicDiscoveryAdapter | null,
    ble: BluetoothBleDiscoveryAdapter | null,
    logger?: OperationLogger,
  ) {
    this.classic = classic;
    this.ble = ble;
    this.logger = logger;
  }

  async discover(options: DiscoveryOptions = {}): Promise<BluetoothDiscoveryReport> {
    const startedAt = new Date().toISOString();
    this.logger?.record({ level: "info", scope: "bluetooth.discovery", event: "scan-start", direction: "internal", message: "Passive Classic and BLE discovery started" });
    const limitations: string[] = [];
    const classicDevices = this.classic === null ? [] : [...await this.classic.scanClassic(options.signal)];
    const bleDevices = this.ble === null ? [] : [...await this.ble.scanBle(options.signal)];
    if (this.classic === null) limitations.push("Bluetooth Classic discovery adapter is unavailable on this platform");
    if (this.ble === null) limitations.push("BLE discovery adapter is unavailable on this platform");

    const sdp: SdpInventory[] = [];
    if (options.inspectClassicSdp === true && this.classic !== null) {
      for (const device of classicDevices) sdp.push(await this.classic.inspectSdp(device, options.signal));
    } else if (classicDevices.length > 0) {
      limitations.push("SDP inspection was not requested; Classic service capabilities remain unknown");
    }

    const gatt: GattInventory[] = [];
    if (options.inspectBleGatt === true && this.ble !== null) {
      for (const device of bleDevices) gatt.push(await this.ble.inspectGattReadOnly(device, options.signal));
    } else if (bleDevices.length > 0) {
      limitations.push("GATT inspection was not requested; BLE services and characteristics remain unknown");
    }

    const report: BluetoothDiscoveryReport = {
      schema: "cube-baby-bluetooth-discovery-v1",
      startedAt,
      finishedAt: new Date().toISOString(),
      devices: [...classicDevices, ...bleDevices],
      gatt,
      sdp,
      limitations,
    };
    this.logger?.record({
      level: "info",
      scope: "bluetooth.discovery",
      event: "scan-finish",
      direction: "internal",
      message: `Discovery finished with ${report.devices.length} device observations`,
      details: { classic: classicDevices.length, ble: bleDevices.length, gatt: gatt.length, sdp: sdp.length },
    });
    return report;
  }
}

/** Deterministic adapter for tests and the hardware-free lab UI. */
export class MockBluetoothDiscoveryAdapter implements BluetoothClassicDiscoveryAdapter, BluetoothBleDiscoveryAdapter {
  readonly classicDevices: readonly BluetoothDeviceObservation[];
  readonly bleDevices: readonly BluetoothDeviceObservation[];
  readonly sdpInventories: Readonly<Record<string, SdpInventory>>;
  readonly gattInventories: Readonly<Record<string, GattInventory>>;
  constructor(
    classicDevices: readonly BluetoothDeviceObservation[] = [],
    bleDevices: readonly BluetoothDeviceObservation[] = [],
    sdpInventories: Readonly<Record<string, SdpInventory>> = {},
    gattInventories: Readonly<Record<string, GattInventory>> = {},
  ) {
    this.classicDevices = classicDevices;
    this.bleDevices = bleDevices;
    this.sdpInventories = sdpInventories;
    this.gattInventories = gattInventories;
  }

  async scanClassic(): Promise<readonly BluetoothDeviceObservation[]> { return this.classicDevices; }
  async scanBle(): Promise<readonly BluetoothDeviceObservation[]> { return this.bleDevices; }
  async inspectSdp(device: BluetoothDeviceObservation): Promise<SdpInventory> {
    const inventory = this.sdpInventories[device.observationId];
    if (inventory === undefined) throw new Error(`no mock SDP inventory for ${device.observationId}`);
    return inventory;
  }
  async inspectGattReadOnly(device: BluetoothDeviceObservation): Promise<GattInventory> {
    const inventory = this.gattInventories[device.observationId];
    if (inventory === undefined) throw new Error(`no mock GATT inventory for ${device.observationId}`);
    return inventory;
  }
}
