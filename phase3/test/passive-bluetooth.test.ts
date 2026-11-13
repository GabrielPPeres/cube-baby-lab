import assert from "node:assert/strict";
import { test } from "node:test";
import { collectPassiveWindowsBluetooth, parseWindowsPnpJson } from "../src/passive-bluetooth.ts";

test("normalizes a single Windows Bluetooth PnP record", () => {
  assert.deepEqual(parseWindowsPnpJson('{"Status":"OK","Class":"Bluetooth","FriendlyName":"Adapter","InstanceId":"USB\\\\VID_0000","Problem":0}'), [{
    status: "OK", className: "Bluetooth", friendlyName: "Adapter", instanceId: "USB\\VID_0000", problem: 0,
  }]);
});

test("passive collector cannot perform discovery, connection, GATT, or SDP", async () => {
  let invocation: { file: string; args: readonly string[] } | undefined;
  const report = await collectPassiveWindowsBluetooth(async (file, args) => {
    invocation = { file, args };
    return { stdout: "[]" };
  }, () => new Date("2026-11-13T12:00:00Z"));
  assert.equal(invocation?.file, "powershell.exe");
  assert.match(invocation?.args.join(" ") ?? "", /Get-PnpDevice/);
  assert.doesNotMatch(invocation?.args.join(" ") ?? "", /Connect|Pair|Gatt|Sdp|Write/iu);
  assert.equal(report.activeDiscoveryPerformed, false);
  assert.equal(report.connectionAttempted, false);
  assert.equal(report.serviceQueryPerformed, false);
  assert.deepEqual(report.devices, []);
});

test("empty and null PnP output are valid empty inventories", () => {
  assert.deepEqual(parseWindowsPnpJson(""), []);
  assert.deepEqual(parseWindowsPnpJson("null"), []);
  assert.throws(() => parseWindowsPnpJson("42"), /unexpected/);
});
