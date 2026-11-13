import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeBank, liveAddress, patchBank, PRESET_BANK_BYTES, type PresetParam, type SlotId } from "../src/presets.ts";
import { encodeMemoryRead, encodeMemoryWrite } from "../src/protocol.ts";
import { PresetSession } from "../src/session.ts";
import { SimulatedTransport } from "../src/transport.ts";

const BASE = Uint8Array.from(Buffer.from("05030306056405070808010101a1a2a305030406417318500808010101b1b2b30600030a59440b0a0805010101c1c2c3", "hex"));
const SLOTS: readonly SlotId[] = ["A", "B", "C"];
const PARAMS: readonly PresetParam[] = ["type", "gain", "tone", "reverb", "feedback", "volume", "time", "mix", "modulation", "cabinet", "irSection", "delaySection", "toneSection"];

test("bank decoder enforces the exact 48-byte boundary", () => {
  assert.equal(BASE.length, PRESET_BANK_BYTES);
  assert.throws(() => decodeBank(BASE.slice(0, 47)), /48/);
  assert.throws(() => decodeBank(Uint8Array.from([...BASE, 0])), /48/);
});

test("every A/B/C parameter patch preserves all trailing bytes 13-15", () => {
  const original = decodeBank(BASE);
  for (const slot of SLOTS) {
    for (const param of PARAMS) {
      const edited = patchBank(original, slot, param, 1);
      assert.deepEqual(edited.slots.map((item) => item.trailing), [[0xa1, 0xa2, 0xa3], [0xb1, 0xb2, 0xb3], [0xc1, 0xc2, 0xc3]]);
      const expectedIndex = SLOTS.indexOf(slot) * 16 + PARAMS.indexOf(param);
      for (let index = 0; index < 48; index += 1) {
        if (index !== expectedIndex) assert.equal(edited.raw[index], original.raw[index]);
      }
    }
  }
});

test("preview addresses include the slot band for A/B/C", async () => {
  const transport = new SimulatedTransport(BASE);
  const session = new PresetSession(transport);
  const expected = { A: 0x80000007, B: 0x80000017, C: 0x80000027 } as const;
  for (const slot of SLOTS) {
    assert.equal(liveAddress(slot, "mix"), expected[slot]);
    await session.preview(slot, "mix", 42);
  }
  assert.equal(transport.live[0x07], 42);
  assert.equal(transport.live[0x17], 42);
  assert.equal(transport.live[0x27], 42);
});

test("encoder rejects out-of-range selector, address, length and empty writes", () => {
  assert.throws(() => encodeMemoryRead(256, 0, 48), /memory/);
  assert.throws(() => encodeMemoryRead(5, -1, 48), /address/);
  assert.throws(() => encodeMemoryRead(5, 0, 0), /length/);
  assert.throws(() => encodeMemoryWrite(5, 0, new Uint8Array()), /length/);
});
