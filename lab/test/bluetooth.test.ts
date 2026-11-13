import assert from "node:assert/strict";
import { test } from "node:test";
import { BluetoothDiscoveryCoordinator, MockBluetoothDiscoveryAdapter } from "../src/bluetooth/discovery.ts";
import { MockBluetoothTransport, type BluetoothControlProfile } from "../src/bluetooth/transport.ts";
import type { BluetoothDeviceObservation, GattInventory, SdpInventory } from "../src/bluetooth/types.ts";
import { TransportDisconnectedError } from "../src/errors.ts";
import { MemoryOperationLogger } from "../src/operation-log.ts";

const classic: BluetoothDeviceObservation = {
  observationId: "mock-classic-1", technology: "classic", addressOrId: "mock:classic:1", name: "Synthetic Classic Device",
  rssi: null, connectable: true, observedAt: "2026-11-13T12:00:00.000Z", authority: "mock",
  advertisedServiceUuids: [], manufacturerDataHex: {}, serviceDataHex: {},
};
const ble: BluetoothDeviceObservation = {
  observationId: "mock-ble-1", technology: "ble", addressOrId: "mock:ble:1", name: "Synthetic BLE Device",
  rssi: -60, connectable: true, observedAt: "2026-11-13T12:00:00.000Z", authority: "mock",
  advertisedServiceUuids: [], manufacturerDataHex: {}, serviceDataHex: {},
};
const sdp: SdpInventory = { deviceObservationId: classic.observationId, observedAt: classic.observedAt, services: [] };
const gatt: GattInventory = { deviceObservationId: ble.observationId, connectedReadOnly: true, observedAt: ble.observedAt, services: [] };

test("discovery keeps Classic/SDP and BLE/GATT as separate evidence", async () => {
  const mock = new MockBluetoothDiscoveryAdapter([classic], [ble], { [classic.observationId]: sdp }, { [ble.observationId]: gatt });
  const report = await new BluetoothDiscoveryCoordinator(mock, mock).discover({ inspectClassicSdp: true, inspectBleGatt: true });
  assert.deepEqual(report.devices.map((device) => device.technology), ["classic", "ble"]);
  assert.equal(report.sdp[0]?.deviceObservationId, classic.observationId);
  assert.equal(report.gatt[0]?.deviceObservationId, ble.observationId);
  assert.deepEqual(report.sdp[0]?.services, []);
  assert.deepEqual(report.gatt[0]?.services, []);
});

test("Bluetooth transport starts disconnected and cannot transmit", async () => {
  const transport = new MockBluetoothTransport();
  assert.equal(transport.state, "disconnected");
  assert.equal(transport.profile, null);
  await assert.rejects(() => transport.exchangeProtocolFrame(Uint8Array.of(1), 100), (error) => error instanceof TransportDisconnectedError);
});

test("unverified control profile is blocked before connection", async () => {
  const transport = new MockBluetoothTransport();
  await assert.rejects(() => transport.connect(
    { observationId: ble.observationId, addressOrId: ble.addressOrId },
    { profileId: "unverified", technology: "ble", verifiedOnCubeBaby: false, evidenceIds: [], framingDescription: "unknown" },
  ), /evidence/);
  assert.equal(transport.state, "disconnected");
});

test("verified mock profile exchanges caller-supplied frames and logs both directions", async () => {
  const logger = new MemoryOperationLogger();
  const profile: BluetoothControlProfile = {
    profileId: "synthetic-test-only", technology: "ble", verifiedOnCubeBaby: true,
    evidenceIds: ["synthetic-test-evidence"], framingDescription: "identity transform for mock test only",
  };
  const transport = new MockBluetoothTransport({ reply: (frame) => Uint8Array.from([...frame].reverse()) }, logger);
  await transport.connect({ observationId: ble.observationId, addressOrId: ble.addressOrId }, profile);
  assert.deepEqual(await transport.exchangeProtocolFrame(Uint8Array.of(1, 2, 3), 100), Uint8Array.of(3, 2, 1));
  assert.deepEqual(logger.entries().filter((entry) => entry.event === "frame").map((entry) => entry.direction), ["tx", "rx"]);
  await transport.disconnect();
  assert.equal(transport.state, "disconnected");
});
