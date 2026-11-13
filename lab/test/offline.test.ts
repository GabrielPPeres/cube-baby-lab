import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeMessage } from "../src/protocol.ts";
import { decodeBank, liveAddress } from "../src/presets.ts";
import { PresetSession } from "../src/session.ts";
import { ExperimentalBluetoothTransport, SimulatedTransport } from "../src/transport.ts";

const BANK = Uint8Array.from(Buffer.from("05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000", "hex"));

test("reads the captured A/B/C fixture offline", async () => {
  const simulator = new SimulatedTransport(BANK);
  const session = new PresetSession(simulator);
  const bank = await session.readBank();
  assert.equal(bank.slots[0].id, "A");
  assert.equal(bank.slots[0].values.volume, 100);
  assert.equal(bank.slots[1].values.volume, 115);
  assert.equal(bank.slots[2].values.cabinet, 5);
  assert.deepEqual(bank.slots.map((slot) => slot.trailing), [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
});

test("edits slot B with full-bank write and read-back verification", async () => {
  const simulator = new SimulatedTransport(BANK);
  const session = new PresetSession(simulator);
  const result = await session.edit("B", "gain", 7);
  assert.equal(result.before.slots[1].values.gain, 3);
  assert.equal(result.after.slots[1].values.gain, 7);
  assert.equal(result.after.slots[0].values.gain, 3);
  assert.equal(result.after.slots[2].values.gain, 0);
  assert.equal(result.ackRawValue, 0, "raw 0 is the value observed in physical ACK frames");
  assert.equal(result.verified, true);
  const writes = simulator.requests.map(decodeMessage).filter((m) => m.kind === "memory-write-request");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].kind === "memory-write-request" ? writes[0].data.length : 0, 48);
});

test("previews slot C at its own live-RAM band", async () => {
  const simulator = new SimulatedTransport(BANK);
  const session = new PresetSession(simulator);
  assert.equal(liveAddress("C", "mix"), 0x80000027);
  const rawAck = await session.preview("C", "mix", 88);
  assert.equal(rawAck, 0);
  assert.equal(simulator.live[0x27], 88);
  assert.equal(decodeBank(simulator.bank).slots[2].values.mix, 10, "preview does not persist the bank");
});

test("Bluetooth transmission is blocked without hardware-verified framing", async () => {
  const transport = new ExperimentalBluetoothTransport(
    { exchangeNotifications: async () => [], close: async () => undefined },
    {
      verifiedOnCubeBaby: false,
      evidenceId: "none",
      encodeProtocolFrame: (frame) => [frame],
      decodeNotifications: () => new Uint8Array(),
    },
  );
  await assert.rejects(() => transport.exchange(Uint8Array.of(0xf0, 0xf7)), /unverified/);
});
