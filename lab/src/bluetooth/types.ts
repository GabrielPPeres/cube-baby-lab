export type BluetoothTechnology = "classic" | "ble";
export type DiscoveryAuthority = "mock" | "os-scan" | "hci-capture" | "manual-import";

export interface BluetoothDeviceObservation {
  readonly observationId: string;
  readonly technology: BluetoothTechnology;
  readonly addressOrId: string;
  readonly name: string | null;
  readonly rssi: number | null;
  readonly connectable: boolean | null;
  readonly observedAt: string;
  readonly authority: DiscoveryAuthority;
  /** Raw advertising/service UUIDs exactly as reported by the platform. */
  readonly advertisedServiceUuids: readonly string[];
  readonly manufacturerDataHex: Readonly<Record<string, string>>;
  readonly serviceDataHex: Readonly<Record<string, string>>;
}

export type GattCharacteristicProperty =
  | "broadcast"
  | "read"
  | "write-without-response"
  | "write"
  | "notify"
  | "indicate"
  | "authenticated-signed-writes"
  | "extended-properties";

export interface GattDescriptorObservation {
  readonly uuid: string;
}

export interface GattCharacteristicObservation {
  readonly uuid: string;
  readonly properties: readonly GattCharacteristicProperty[];
  readonly descriptors: readonly GattDescriptorObservation[];
}

export interface GattServiceObservation {
  readonly uuid: string;
  readonly primary: boolean;
  readonly characteristics: readonly GattCharacteristicObservation[];
}

export interface GattInventory {
  readonly deviceObservationId: string;
  readonly connectedReadOnly: true;
  readonly observedAt: string;
  readonly services: readonly GattServiceObservation[];
}

export interface SdpProtocolDescriptor {
  readonly protocolUuid: string;
  readonly parameters: readonly number[];
}

export interface SdpServiceObservation {
  readonly recordHandle: string | null;
  readonly serviceName: string | null;
  readonly serviceClassUuids: readonly string[];
  readonly protocolDescriptors: readonly SdpProtocolDescriptor[];
  readonly attributesHex: Readonly<Record<string, string>>;
}

export interface SdpInventory {
  readonly deviceObservationId: string;
  readonly observedAt: string;
  readonly services: readonly SdpServiceObservation[];
}

export interface BluetoothDiscoveryReport {
  readonly schema: "cube-baby-bluetooth-discovery-v1";
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly devices: readonly BluetoothDeviceObservation[];
  readonly gatt: readonly GattInventory[];
  readonly sdp: readonly SdpInventory[];
  readonly limitations: readonly string[];
}
