import assert from "node:assert/strict";
import { test } from "node:test";
import { exportPresetBackup, importPresetBackup } from "../src/backup.ts";
import { LabController } from "../src/lab-controller.ts";
import { MemoryOperationLogger } from "../src/operation-log.ts";
import { decodeBank } from "../src/presets.ts";
import { PresetSession } from "../src/session.ts";
import { SimulatedTransport } from "../src/transport.ts";

const BANK = Uint8Array.from(Buffer.from("05030306056405070808010101a1a2a305030406417318500808010101b1b2b30600030a59440b0a0805010101c1c2c3", "hex"));

test("backup export/import round-trips all 48 bytes including trailing data", () => {
  const bank = decodeBank(BANK);
  const text = exportPresetBackup(bank, { createdAt: "2026-11-13T12:00:00.000Z", note: "test" });
  assert.deepEqual(importPresetBackup(text).raw, BANK);
});

test("backup import rejects schema and size failures", () => {
  assert.throws(() => importPresetBackup("{}"), /schema/);
  assert.throws(() => importPresetBackup(JSON.stringify({ schema: "cube-baby-preset-bank-lab-v1", createdAt: "2026-11-13T12:00:00.000Z", byteLength: 47, dataHex: "00" })), /48/);
});

test("lab controller edits, displays hex rows and restores a backup offline", async () => {
  const transport = new SimulatedTransport(BANK);
  const logger = new MemoryOperationLogger();
  const session = new PresetSession(transport, { logger });
  const controller = new LabController(session, logger);
  await controller.initialize();
  const backup = controller.exportBackup("before edit");
  controller.selectSlot("C");
  await controller.edit("volume", 99);
  assert.equal(controller.bank?.slots[2].values.volume, 99);
  assert.equal(controller.hexRows().length, 3);
  await controller.importBackup(backup);
  assert.deepEqual(controller.bank?.raw, BANK);
  assert.ok(logger.entries().some((entry) => entry.event === "bank-restore"));
});
