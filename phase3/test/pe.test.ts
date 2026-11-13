import assert from "node:assert/strict";
import { test } from "node:test";
import { findBytePattern, findTextEvidence, parsePe } from "../src/pe.ts";

function minimalPe(): Uint8Array {
  const bytes = new Uint8Array(0x400);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4d, 0x5a]);
  view.setUint32(0x3c, 0x80, true);
  view.setUint32(0x80, 0x00004550, true);
  const coff = 0x84;
  view.setUint16(coff, 0x14c, true);
  view.setUint16(coff + 2, 1, true);
  view.setUint32(coff + 4, 0x12345678, true);
  view.setUint16(coff + 16, 0xe0, true);
  view.setUint16(coff + 18, 0x102, true);
  const optional = coff + 20;
  view.setUint16(optional, 0x10b, true);
  view.setUint32(optional + 16, 0x1000, true);
  view.setUint32(optional + 28, 0x400000, true);
  view.setUint16(optional + 68, 2, true);
  view.setUint16(optional + 70, 0x140, true);
  view.setUint32(optional + 92, 16, true);
  const section = optional + 0xe0;
  bytes.set(Buffer.from(".text\0\0\0"), section);
  view.setUint32(section + 8, 0x100, true);
  view.setUint32(section + 12, 0x1000, true);
  view.setUint32(section + 16, 0x200, true);
  view.setUint32(section + 20, 0x200, true);
  view.setUint32(section + 36, 0x60000020, true);
  return bytes;
}

test("PE parser validates a minimal PE32 image without executing it", () => {
  const info = parsePe(minimalPe());
  assert.equal(info.format, "pe32");
  assert.equal(info.architecture, "x86");
  assert.equal(info.timestamp, 0x12345678);
  assert.equal(info.sections[0]?.name, ".text");
  assert.deepEqual(info.imports, []);
});

test("PE parser rejects malformed and truncated inputs", () => {
  assert.throws(() => parsePe(new Uint8Array(64)), /MZ/);
  const bytes = minimalPe();
  bytes[0x80] = 0;
  assert.throws(() => parsePe(bytes), /signature/);
});

test("static evidence scans preserve offsets and do not infer semantics", () => {
  const bytes = Buffer.from("xxBluetooth MIDI available BLE yy\0G\0A\0T\0T\0");
  const matches = findTextEvidence(bytes, ["Bluetooth", "MIDI", "BLE", "GATT"]);
  assert.deepEqual(matches.map((item) => item.terms), [["Bluetooth", "MIDI", "BLE"], ["GATT"]]);
  assert.deepEqual(findTextEvidence(Buffer.from("available disabled"), ["BLE"]), []);
  assert.deepEqual(findBytePattern(bytes, Buffer.from("MIDI")), [12]);
});
