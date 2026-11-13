import assert from "node:assert/strict";
import { test } from "node:test";
import { TransportTimeoutError, VerificationError } from "../src/errors.ts";
import { PresetSession } from "../src/session.ts";
import { SimulatedTransport } from "../src/transport.ts";

const BANK = Uint8Array.from(Buffer.from("05030306056405070808010101000000050304064173185008080101010000000600030a59440b0a0805010101000000", "hex"));

test("read fails with a typed timeout when the transport drops replies", async () => {
  const session = new PresetSession(new SimulatedTransport(BANK, { dropReplies: true }), { timeoutMs: 15 });
  await assert.rejects(() => session.readBank(), (error) => error instanceof TransportTimeoutError && error.timeoutMs === 15);
});

test("read rejects a corrupted checksum", async () => {
  const session = new PresetSession(new SimulatedTransport(BANK, { corruptReadChecksum: true }), { timeoutMs: 100 });
  await assert.rejects(() => session.readBank(), /invalid preset-bank read response|Cube Baby envelope|length mismatch/);
});

test("read rejects a response whose payload is not exactly 48 bytes", async () => {
  const session = new PresetSession(new SimulatedTransport(BANK, { overrideReadBank: BANK.slice(0, 47) }), { timeoutMs: 100 });
  await assert.rejects(() => session.readBank(), /invalid preset-bank read response/);
});

test("persistent edit fails when read-back does not reflect the write", async () => {
  const session = new PresetSession(new SimulatedTransport(BANK, { ignoreBankWrites: true }), { timeoutMs: 100 });
  await assert.rejects(() => session.edit("C", "gain", 7), (error) => error instanceof VerificationError);
});

test("preview rejects values outside one byte", async () => {
  const session = new PresetSession(new SimulatedTransport(BANK));
  await assert.rejects(() => session.preview("A", "gain", 256), /unsigned byte/);
});
