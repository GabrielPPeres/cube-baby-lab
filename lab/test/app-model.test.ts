import assert from "node:assert/strict";
import { test } from "node:test";
import { CAPTURED_BANK_HEX, editByte, exportBackup, fromHex, importBackup, readSlot } from "../app/model.ts";

test("browser lab model edits each slot and preserves trailing bytes", () => {
  let bytes = fromHex(CAPTURED_BANK_HEX);
  const trailing = [0, 1, 2].map((slot) => readSlot(bytes, slot).trailing);
  bytes = editByte(bytes, 0, 1, 7);
  bytes = editByte(bytes, 1, 1, 6);
  bytes = editByte(bytes, 2, 1, 5);
  assert.deepEqual([0, 1, 2].map((slot) => readSlot(bytes, slot).trailing), trailing);
  assert.deepEqual([0, 1, 2].map((slot) => readSlot(bytes, slot).values.gain), [7, 6, 5]);
});

test("browser lab backup round-trips", () => {
  const bytes = fromHex(CAPTURED_BANK_HEX);
  assert.deepEqual(importBackup(exportBackup(bytes, "2026-11-13T12:00:00.000Z")), bytes);
});
